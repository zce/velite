import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'

import { name as pkgName } from '../../../../package.json'

import type { Jiti, ModuleCache, NodeModule } from 'jiti'
import type { Module } from 'node:module'
import type { ModuleLoader } from '../../modules'

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
        if (!/[\\/]node_modules[\\/]/.test(dependency) && nativeCache[dependency] === observed) delete nativeCache[dependency]
      }
      const observedNative = new Set<Module>()
      const rememberNative = (module: Module): void => {
        if (observedNative.has(module)) return
        const { filename } = module
        // A used child can outlive its cache entry. Watch its filename, but keep
        // every consumed identity: an old child must not replace a fresh one,
        // and invalidation must not evict another caller's unconsumed entry.
        observedNative.add(module)
        // Native CJS children include already-cached imports. Stay within local
        // config dependencies, not an installed package's shared module graph.
        if (/[\\/]node_modules[\\/]/.test(filename)) return
        for (const child of module.children) rememberNative(child)
      }
      // jiti publishes each evaluated Module into this supported per-load cache
      // before running it. Observe that Module's own public require/import calls,
      // including pre-cached JSON, rather than a process-wide cache time window.
      const cache: ModuleCache = new Proxy(Object.create(null), {
        set(target: ModuleCache, filename: string, module: NodeModule) {
          const require = module.require as Jiti
          const remember = (resolve: () => string | undefined): void => {
            try {
              const resolved = resolve()
              if (!resolved || (!isAbsolute(resolved) && !resolved.startsWith('file:'))) return
              const path = resolved.startsWith('file:') ? fileURLToPath(resolved) : resolved
              if (cache[path]) return
              const native = nativeCache[path]
              if (native) rememberNative(native)
            } catch {
              // Dependency observation must not change a successful import's outcome.
            }
          }
          module.require = new Proxy(require, {
            apply(_target, _thisArg, [id]: [string]) {
              const exports = require(id)
              remember(() => require.resolve(id))
              return exports
            }
          })
          const importModule = require.import
          require.import = async <T>(id: string, options?: Parameters<Jiti['import']>[1]) => {
            const exports = await importModule<T>(id, options)
            remember(() => require.esmResolve(id, options))
            return exports
          }
          target[filename] = module
          return true
        }
      })
      try {
        const namespace = await jiti.evalModule(await readFile(absPath, 'utf8'), { filename: absPath, async: true, forceTranspile: true, cache })
        // Same default-export policy as jiti.import(path, { default: true }).
        const exports = (namespace as { default?: unknown } | undefined)?.default ?? namespace
        const dependencies = [...new Set([...Object.keys(cache), ...Array.from(observedNative, module => module.filename)])]
        return { exports, dependencies }
      } finally {
        nativeDependencies = observedNative
      }
    }
  }
}
