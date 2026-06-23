import { resolveConfig } from './config'
import { fail } from './diagnostic'
import { createDriver, createRunContext } from './driver'
import { createEngine } from './engine'
import { createLoaderRegistry } from './loader'
import { createPipeline } from './pipeline'
import { createScheduler } from './scheduler'
import { installContextStorage } from './schema/context'

import type { Runtime } from '../runtime'
import type { ContextStorage } from '../runtime/contextual'
import type { FileEvent } from '../runtime/watcher'
import type { ResolvedConfig } from './config'
import type { BuildResult, Driver, RunContext } from './driver'
import type { Engine } from './engine'
import type { Loader } from './loader'
import type { Pipeline } from './pipeline'
import type { Scheduler } from './scheduler'
import type { SchemaContext } from './schema/context'

export interface BuildOptions {
  signal?: AbortSignal
  /** Output layout override (default: `split` in dev, `single` in production). */
  layout?: 'split' | 'single'
}

export interface WatchOptions {
  onRebuild?(result: BuildResult): void
  /** Debounce window for merging file events (default 50ms). */
  debounceMs?: number
}

export interface WatchHandle {
  /** Initial build result. The watcher runs exactly one build before subscribing. */
  initial: BuildResult
  close(): Promise<void>
}

/** The durable build instance. Holds the engine (= incremental database). */
export interface Builder {
  build(options?: BuildOptions): Promise<BuildResult>
  /**
   * Run the single initial build and start watching. The handle carries the
   * initial {@link BuildResult} so callers don't run a second build for
   * strict-mode handling or logging.
   */
  watch(options?: WatchOptions, build?: BuildOptions): Promise<WatchHandle>
  /** Apply file events to the engine and return an incremental rebuild (or undefined if the events change nothing). */
  apply(events: FileEvent[]): Promise<BuildResult | undefined>
  /** Remove the configured output directories. Idempotent on missing dirs. */
  clean(): Promise<void>
  dispose(): Promise<void>
}

export interface CreateBuilderOptions {
  cwd: string
  /** Explicit config path. When omitted, `resolveConfig` searches from `cwd`. */
  configPath?: string
  loaders?: Loader[]
}

export interface BuilderDeps extends CreateBuilderOptions {
  runtime: Runtime
}

interface Session {
  config: ResolvedConfig
  engine: Engine
  pipeline: Pipeline
  context: RunContext
  driver: Driver
}

/**
 * The watch subsystem's state. Lives only when a watch is active; both fields
 * are created together and torn down together, so they are grouped so the
 * tear-down path can't leak one without the other.
 */
interface WatchState {
  scheduler: Scheduler
  unsubscribe: () => void
}

const loadSession = async (runtime: Runtime, options: CreateBuilderOptions): Promise<Session> => {
  const config = await resolveConfig(runtime, { cwd: options.cwd, configPath: options.configPath })
  const loaders = createLoaderRegistry(options.loaders ?? [])
  const { fs, image } = runtime
  const pipeline = createPipeline({ config, loaders, fs, image })
  const engine = createEngine()
  const context = await createRunContext({ engine, pipeline, config, runtime, cwd: options.cwd })
  const driver = createDriver({ context })
  return { config, engine, pipeline, context, driver }
}

/**
 * Composition root (Pure DI): assembles runtime + config + engine + pipeline into a
 * Builder. No DI framework — the Runtime object is the container, wired here.
 *
 * State lives in three closures captured here, each with a single owner:
 *  - `session`: the loaded config + engine + pipeline. Lazy on first build();
 *    replaced wholesale on a `config-reload`.
 *  - `activeLayout`: a build-time preference, sticky from the first `build()`
 *    so incremental/watch rebuilds stay consistent. Core never reads
 *    `process.env`; the root entry decides the env-based default and passes
 *    it via `BuildOptions`.
 *  - `watchState`: only present while a watch is running. Bundled so close()
 *    can't drop half of it.
 */
export const createBuilder = ({ runtime, ...options }: BuilderDeps): Builder => {
  // Install the runtime's context storage once, so schema transforms can
  // propagate the SchemaContext through zod's async callbacks. The port is
  // type-erased at the runtime boundary; narrow it here to SchemaContext.
  installContextStorage(runtime.contextStorage as ContextStorage<SchemaContext>)

  let session: Session | undefined
  let activeLayout: 'split' | 'single' = 'split'
  let watchState: WatchState | undefined

  /**
   * Internal mutex so concurrent `build()`/`apply()` calls don't race on
   * `RunContext.manifest`, `assetManifest`, the tree shadow copy, or the
   * underlying engine inputs. Watch rebuilds also flow through `apply()` and
   * are scheduler-debounced, but a programmatic caller invoking
   * `build()`/`apply()` from multiple turns is the case this prevents. The
   * promise chain auto-shrinks once each await completes.
   */
  let runLock: Promise<unknown> = Promise.resolve()
  const serialize = <R>(run: () => Promise<R>): Promise<R> => {
    const next = runLock.then(run, run)
    runLock = next.catch(() => {})
    return next
  }

  /** Load (or reload) the session. Pass `force` to replace an existing one. */
  const ensureSession = async (force = false): Promise<Session> => {
    if (force || session === undefined) session = await loadSession(runtime, options)
    return session
  }

  const closeWatch = (): void => {
    if (watchState === undefined) return
    watchState.scheduler.dispose()
    watchState.unsubscribe()
    watchState = undefined
  }

  const build = async (buildOptions?: BuildOptions): Promise<BuildResult> =>
    serialize(async () => {
      const current = await ensureSession()
      if (buildOptions?.layout !== undefined) activeLayout = buildOptions.layout
      return current.driver.runBuild(activeLayout)
    })

  const apply = async (events: FileEvent[]): Promise<BuildResult | undefined> =>
    serialize(async () => {
      const current = await ensureSession()
      const result = await current.driver.applyChanges(events)
      if (result === 'config-reload') {
        const reloaded = await ensureSession(true)
        return reloaded.driver.runBuild(activeLayout)
      }
      if (result === 'content') return current.driver.runIncremental(activeLayout)
      return undefined
    })

  const watch = async (watchOptions: WatchOptions = {}, buildOptions?: BuildOptions): Promise<WatchHandle> =>
    serialize(async () => {
      if (runtime.watch === undefined) fail('watch', 'watch is not available: runtime has no watch support')
      // A second watch() call replaces the previous subscription instead of
      // leaking it — calling watch() twice on the same builder is unusual but
      // shouldn't strand a chokidar instance. Because the whole flow runs
      // inside the same `serialize()` critical section as `build()`/`apply()`,
      // two concurrent watch() calls can't interleave their setup either.
      closeWatch()
      const current = await ensureSession()
      if (buildOptions?.layout !== undefined) activeLayout = buildOptions.layout
      const initial = await current.driver.runBuild(activeLayout)
      const watcher = runtime.watch([current.config.root, current.config.configPath])
      const scheduler = createScheduler({
        run: async events => {
          const result = await apply(events)
          if (result !== undefined) watchOptions.onRebuild?.(result)
        },
        debounceMs: watchOptions.debounceMs
      })
      const unsubscribe = watcher.subscribe(event => scheduler.push([event]))
      watchState = { scheduler, unsubscribe }
      return {
        initial,
        close: async () => closeWatch()
      }
    })

  const dispose = async (): Promise<void> => {
    closeWatch()
    session = undefined
  }

  const clean = async (): Promise<void> => {
    const current = await ensureSession()
    await runtime.fs.remove(current.config.output.data, { recursive: true })
    await runtime.fs.remove(current.config.output.assets, { recursive: true })
    // Drop the persisted manifest state too — the on-disk file was just
    // wiped, so the in-memory bookkeeping must match. Otherwise the next
    // build would try to "reconcile" files that no longer exist.
    current.context.manifest = { files: {} }
    current.context.assetManifest = new Set()
  }

  return {
    build,
    watch,
    apply,
    clean,
    dispose
  }
}
