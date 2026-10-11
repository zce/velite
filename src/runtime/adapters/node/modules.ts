import { AsyncLocalStorage } from 'node:async_hooks'
import { readFile } from 'node:fs/promises'
import { createRequire, Module } from 'node:module'
import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'

import { name as pkgName } from '../../../../package.json'

import type { Jiti, ModuleCache, NodeModule } from 'jiti'
import type { ModuleLoader } from '../../modules'

interface NativeListener {
  active: () => boolean
  consume: (module: Module) => void
  cache: NodeJS.Require['cache']
}

interface NativeObservation {
  listeners: Set<NativeListener>
  restore: () => void
}

const childrenObservation = Symbol('config children observation')
const cacheObservation = Symbol('config cache observation')

// A Module is appended to its parent's children before its constructor
// initializes filename and children; its id is already the actual resolved
// native filename.
const nativeFilename = (module: Module): string => module.filename || module.id

// Native CJS dependencies of a local configuration stay within the project,
// not an installed package's shared module graph.
const isInstalledPath = (filename: string): boolean => /[\\/]node_modules[\\/]/.test(filename)

/**
 * Node's CJS loader internals are not part of the public type surface. These
 * boundaries type only the members the adapter interposes on, with the exact
 * shapes observed on the supported runtimes.
 */
interface NativeModuleStatics {
  _load?: (request: string, parent?: Module | null, isMain?: boolean) => unknown
}

interface NativeModulePrototype {
  load?: (this: Module, filename: string) => void
}

/**
 * One entry per in-flight configuration evaluation. The observer decides
 * whether a native load belongs to its own evaluation through its async scope,
 * so overlapping loaders stay isolated while sharing the interposed methods.
 */
interface NativeLoadObserver {
  active: () => boolean
  consuming: (module: Module) => void
  inScope: () => boolean
  inExcluded: () => boolean
  excludeSubtree: (run: () => unknown) => unknown
  observeParent: (parent: Module | null | undefined) => () => void
}

const interposed = {
  observers: new Set<NativeLoadObserver>(),
  installed: false,
  load: undefined as ((request: string, parent?: Module | null, isMain?: boolean) => unknown) | undefined,
  prototypeLoad: undefined as ((this: Module, filename: string) => void) | undefined,
  loadDescriptor: undefined as PropertyDescriptor | undefined,
  prototypeLoadDescriptor: undefined as PropertyDescriptor | undefined
}

/**
 * User-authorized, per-evaluation interposition of Node's native load entry
 * (see plan.md, "User decision recorded"). Wrappers only propagate installed
 * exclusion and consume the actual new Module before its source runs; they
 * never resolve, replay or alter a native call. The methods are restored by
 * the last releasing evaluation with identity checks.
 */
const restoreNativeLoadInterposition = (): void => {
  if (!interposed.installed || interposed.observers.size > 0) return
  const statics = Module as unknown as NativeModuleStatics
  const prototype = Module.prototype as unknown as NativeModulePrototype
  if (statics._load === interposed.load) {
    Object.defineProperty(Module, '_load', { configurable: true, writable: true, ...interposed.loadDescriptor })
  }
  if (prototype.load === interposed.prototypeLoad) {
    Object.defineProperty(Module.prototype, 'load', {
      configurable: true,
      writable: true,
      ...interposed.prototypeLoadDescriptor
    })
  }
  interposed.installed = false
  interposed.load = undefined
  interposed.prototypeLoad = undefined
  interposed.loadDescriptor = undefined
  interposed.prototypeLoadDescriptor = undefined
}

const installNativeLoadObserver = (observer: NativeLoadObserver): (() => void) => {
  interposed.observers.add(observer)
  if (!interposed.installed) {
    interposed.loadDescriptor = Object.getOwnPropertyDescriptor(Module, '_load')
    interposed.prototypeLoadDescriptor = Object.getOwnPropertyDescriptor(Module.prototype, 'load')
    const originalLoad = interposed.loadDescriptor?.value as NativeModuleStatics['_load']
    const originalPrototypeLoad = interposed.prototypeLoadDescriptor?.value as NativeModulePrototype['load']
    if (originalLoad && originalPrototypeLoad) {
      interposed.load = function (request: string, parent?: Module | null, isMain?: boolean) {
        let owner: NativeLoadObserver | undefined
        for (const candidate of interposed.observers)
          if (candidate.inScope()) {
            owner = candidate
            break
          }
        if (!owner) return Reflect.apply(originalLoad, Module, [request, parent, isMain])
        const parentFilename = parent ? nativeFilename(parent) : undefined
        const excludedSubtree = owner.inExcluded() || (parentFilename !== undefined && isInstalledPath(parentFilename))
        if (excludedSubtree) return owner.excludeSubtree(() => Reflect.apply(originalLoad, Module, [request, parent, isMain]))
        // Both a cache hit and a new module are appended to the actual parent's
        // children before this call returns. Observing that real insertion
        // captures the consumed Module — including Node's same-directory fast
        // path — without resolving, replaying or scanning any cache.
        const releaseParent = owner.observeParent(parent)
        try {
          return Reflect.apply(originalLoad, Module, [request, parent, isMain])
        } finally {
          releaseParent()
        }
      }
      interposed.prototypeLoad = function (this: Module, filename: string) {
        for (const candidate of interposed.observers) if (candidate.active()) candidate.consuming(this)
        return Reflect.apply(originalPrototypeLoad, this, [filename])
      }
      Object.defineProperty(Module, '_load', { configurable: true, writable: true, enumerable: false, value: interposed.load })
      Object.defineProperty(Module.prototype, 'load', {
        configurable: true,
        writable: true,
        enumerable: false,
        value: interposed.prototypeLoad
      })
      interposed.installed = true
    } else {
      // Unsupported native loader shape: keep every original outcome untouched.
      interposed.loadDescriptor = undefined
      interposed.prototypeLoadDescriptor = undefined
    }
  }
  let released = false
  return () => {
    if (released) return
    released = true
    interposed.observers.delete(observer)
    restoreNativeLoadInterposition()
  }
}

const subscribe = (observation: NativeObservation, listener: NativeListener): (() => void) => {
  // Each require attempt owns a subscription, including overlapping imports by
  // the same loader. The observation lives only on the concrete Module/slot.
  const subscription = { ...listener }
  observation.listeners.add(subscription)
  return () => {
    // Exactly one release per subscription may drive the last-listener
    // restore; a repeated release must not re-enter restore.
    if (!observation.listeners.delete(subscription)) return
    if (observation.listeners.size === 0) observation.restore()
  }
}

const consume = (observation: NativeObservation, module: Module | undefined): void => {
  if (module) for (const listener of observation.listeners) if (listener.active()) listener.consume(module)
}

const observeChildren = (module: Module, listener: NativeListener): (() => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(module, 'children')
  const previous = (descriptor?.get as ((() => Module[]) & { [childrenObservation]?: NativeObservation }) | undefined)?.[childrenObservation]
  if (previous) return subscribe(previous, listener)
  // Native cached Modules can be frozen by their owner. Do not turn a valid
  // cache hit into an exception (and jiti fallback/source replay) for observing it.
  const requireDescriptor = Object.getOwnPropertyDescriptor(module, 'require')
  if (!Object.isExtensible(module) || descriptor?.configurable === false || (requireDescriptor && requireDescriptor.writable !== true)) return () => {}
  let children = module.children
  let view: Module[] | undefined
  const require = module.require
  const observation: NativeObservation = {
    listeners: new Set(),
    restore() {
      // Keep the original array, including Node's normal failed-child removal.
      if (Object.getOwnPropertyDescriptor(module, 'children')?.get === get)
        Object.defineProperty(module, 'children', { configurable: true, enumerable: true, writable: true, ...descriptor, value: children })
      if (module.require === observedRequire) {
        if (requireDescriptor) Object.defineProperty(module, 'require', requireDescriptor)
        else delete (module as Partial<Module>).require
      }
    }
  }
  const wrap = (value: Module[] | undefined): Module[] | undefined =>
    value &&
    new Proxy(value, {
      set(target, key, child) {
        const result = Reflect.set(target, key, child)
        if (key !== 'length' && child instanceof Module) consume(observation, child)
        return result
      }
    })
  const get = Object.assign(() => view, { [childrenObservation]: observation })
  const observedRequire = new Proxy(require, {
    apply(target, thisArg: Module, args: [string]) {
      const releases: (() => void)[] = []
      // Node does not append a cached child twice. Observe actual cache reads
      // for the already-known direct children during this native require; new
      // children are captured by insertion. No second resolver or source guess.
      const filenames = new Set((thisArg.children ?? []).map(nativeFilename))
      for (const listener of observation.listeners)
        if (listener.active()) for (const filename of filenames) releases.push(observeCacheSlot(listener.cache, filename, listener))
      try {
        return Reflect.apply(target, thisArg, args)
      } finally {
        for (const release of releases) release()
      }
    }
  })
  view = wrap(children)
  module.require = observedRequire
  Object.defineProperty(module, 'children', {
    configurable: true,
    enumerable: true,
    get,
    set(value: Module[]) {
      children = value
      view = wrap(value)
    }
  })
  return subscribe(observation, listener)
}

const observeCacheSlot = (cache: NodeJS.Require['cache'], filename: string, listener: NativeListener): (() => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(cache, filename)
  const previous = (descriptor?.get as ((() => Module | undefined) & { [cacheObservation]?: NativeObservation }) | undefined)?.[cacheObservation]
  if (previous) return subscribe(previous, listener)
  let module = descriptor?.value as Module | undefined
  const observation: NativeObservation = {
    listeners: new Set(),
    restore() {
      if (Object.getOwnPropertyDescriptor(cache, filename)?.get !== get) return
      if (!descriptor && !module) delete cache[filename]
      else Object.defineProperty(cache, filename, { configurable: true, enumerable: true, writable: true, ...descriptor, value: module })
    }
  }
  const get = Object.assign(
    () => {
      consume(observation, module)
      return module
    },
    { [cacheObservation]: observation }
  )
  Object.defineProperty(cache, filename, {
    configurable: true,
    enumerable: true,
    get,
    set(value: Module) {
      // Node publishes an uncached Module before executing its source. A later
      // replacement is not consumed merely because another caller wrote it.
      const published = !module
      module = value
      if (published) consume(observation, value)
    }
  })
  return subscribe(observation, listener)
}

export interface JitiModuleLoaderDeps {
  packageName?: string
  baseUrl?: string
}

export const createJitiModuleLoader = ({ packageName = pkgName, baseUrl = import.meta.url }: JitiModuleLoaderDeps = {}): ModuleLoader => {
  const nativeCache = createRequire(baseUrl).cache
  let nativeDependencies = new Set<Module>()
  const createLoader = (): ReturnType<typeof createJiti> =>
    createJiti(baseUrl, {
      interopDefault: true,
      moduleCache: false,
      alias: {
        [packageName]: fileURLToPath(import.meta.resolve(packageName))
      }
    })

  /**
   * Module loader adapter using jiti to import TS/JS modules at runtime (no
   * separate build step). Disable the native runtime cache and evaluate into a
   * fresh explicit cache, re-evaluating configs and transformed dependencies
   * without losing watch tracking. Force the root through jiti as native ESM
   * imports otherwise keep a changed JS/MJS config cached by URL. Native ESM
   * helper URL caching remains jiti/Node behavior, not a custom module graph.
   */
  return {
    async load(absPath) {
      const jiti = createLoader()
      // Only previously observed local config imports are invalidated. Keep
      // installed packages' native identity and never purge the global cache.
      for (const observed of nativeDependencies) {
        const dependency = observed.filename
        if (!isInstalledPath(dependency) && nativeCache[dependency] === observed) delete nativeCache[dependency]
      }
      const observedNative = new Set<Module>()
      const scope = new AsyncLocalStorage<boolean>()
      const excluded = new AsyncLocalStorage<boolean>()
      const childrenSubscriptions = new Map<Module, () => void>()
      const requestSubscriptions = new Set<() => void>()
      let closed = false
      const listener: NativeListener = {
        active: () => !closed && scope.getStore() === true && excluded.getStore() !== true,
        consume: module => rememberNative(module),
        cache: nativeCache
      }
      const rememberNative = (module: Module): void => {
        if (observedNative.has(module)) return
        // A used child can outlive its cache entry. Watch its filename, but keep
        // every consumed identity: an old child must not replace a fresh one,
        // and invalidation must not evict another caller's unconsumed entry.
        observedNative.add(module)
        if (isInstalledPath(nativeFilename(module))) return
        childrenSubscriptions.set(module, observeChildren(module, listener))
        for (const child of module.children ?? []) rememberNative(child)
      }
      const watch = (resolve: () => string | undefined): (() => void) => {
        if (!listener.active()) return () => {}
        let resolved: string | undefined
        try {
          resolved = resolve()
        } catch {
          // Let the original import produce its original resolution error.
        }
        if (!resolved || (!isAbsolute(resolved) && !resolved.startsWith('file:'))) return () => {}
        const filename = resolved.startsWith('file:') ? fileURLToPath(resolved) : resolved
        const unsubscribe = observeCacheSlot(nativeCache, filename, listener)
        const release = () => {
          if (!requestSubscriptions.delete(release)) return
          unsubscribe()
        }
        requestSubscriptions.add(release)
        return release
      }
      // User-authorized native load interposition observes the actual Module
      // objects created by any in-scope native require, including a separate
      // createRequire owner, before Node removes a failed child. Installed
      // subtrees propagate their exclusion through the same native load path.
      const releaseNativeLoadObserver = installNativeLoadObserver({
        active: () => listener.active(),
        consuming: module => rememberNative(module),
        inScope: () => scope.getStore() === true && !closed,
        inExcluded: () => excluded.getStore() === true,
        excludeSubtree: run => excluded.run(true, run),
        observeParent: parent => {
          if (!parent || !listener.active()) return () => {}
          const release = observeChildren(parent, listener)
          // A cache hit whose child is already on this owner appends nothing
          // new; modules consumed outside this evaluation stay unconsumed.
          // Only children actually inserted during this real request count.
          const previous = new Set(parent.children ?? [])
          return () => {
            try {
              for (const child of parent.children ?? []) if (!previous.has(child)) rememberNative(child)
            } finally {
              release()
            }
          }
        }
      })
      // jiti publishes each evaluated Module into this supported per-load cache
      // before running it. Observe that Module's own public require/import calls,
      // including pre-cached JSON, rather than a process-wide cache time window.
      const cache: ModuleCache = new Proxy(Object.create(null), {
        set(target: ModuleCache, filename: string, module: NodeModule) {
          const require = module.require as Jiti
          module.require = new Proxy(require, {
            apply(_target, thisArg, args: [string]) {
              const release = watch(() => require.resolve(args[0]))
              try {
                return Reflect.apply(require, thisArg, args)
              } finally {
                release()
              }
            }
          })
          const importModule = require.import
          require.import = async <T>(id: string, options?: Parameters<Jiti['import']>[1]) => {
            const release = watch(() => require.esmResolve(id, options))
            try {
              return await importModule<T>(id, options)
            } finally {
              release()
            }
          }
          target[filename] = module
          return true
        }
      })
      let exports: unknown
      try {
        const source = await readFile(absPath, 'utf8')
        const namespace = await scope.run(true, () => jiti.evalModule(source, { filename: absPath, async: true, forceTranspile: true, cache }))
        // Same default-export policy as jiti.import(path, { default: true }).
        exports = (namespace as { default?: unknown } | undefined)?.default ?? namespace
      } finally {
        closed = true
        releaseNativeLoadObserver()
        for (const release of requestSubscriptions) release()
        for (const release of childrenSubscriptions.values()) release()
        childrenSubscriptions.clear()
        excluded.disable()
        scope.disable()
        nativeDependencies = observedNative
      }
      const dependencies = [...new Set([...Object.keys(cache), ...Array.from(observedNative, nativeFilename)])]
      return { exports, dependencies }
    }
  }
}
