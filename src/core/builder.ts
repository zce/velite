import { resolveConfig } from './config'
import { createDriver, createRunContext } from './driver'
import { createEngine } from './engine'
import { createLoaderRegistry } from './loader'
import { createPipeline } from './pipeline'
import { createScheduler } from './scheduler'
import { installContextStorage, SchemaContext } from './schema/context'

import type { ContextStorage } from '../runtime/contextual'
import type { FileSystem } from '../runtime/fs'
import type { ImageProcessor } from '../runtime/image'
import type { Logger } from '../runtime/logger'
import type { ModuleLoader } from '../runtime/modules'
import type { FileEvent, Watcher } from '../runtime/watcher'
import type { ResolvedConfig } from './config'
import type { BuildResult, Driver, RunContext } from './driver'
import type { Engine } from './engine'
import type { Loader } from './loader'
import type { Pipeline } from './pipeline'
import type { Scheduler } from './scheduler'

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
  fs: FileSystem
  modules: ModuleLoader
  contextStorage: ContextStorage<SchemaContext>
  logger: Logger
  image: ImageProcessor
  watch: (paths: string[]) => Watcher
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

const loadSession = async (deps: BuilderDeps): Promise<Session> => {
  const { fs, image, logger, modules } = deps
  const config = await resolveConfig({ fs, modules }, { cwd: deps.cwd, configPath: deps.configPath })
  logger.debug(`using config '${config.configPath}'`)
  const loaders = createLoaderRegistry(deps.loaders ?? [])
  const pipeline = createPipeline({ config, loaders, fs, image })
  const engine = createEngine()
  const context = await createRunContext({ engine, pipeline, config, runtime: { fs, logger }, cwd: deps.cwd })
  const driver = createDriver({ context })
  return { config, engine, pipeline, context, driver }
}

/**
 * Composition root (Pure DI): assembles explicit runtime capabilities + config +
 * engine + pipeline into a Builder. No DI framework or broad runtime container.
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
export const createBuilder = (deps: BuilderDeps): Builder => {
  const { contextStorage, fs, watch: createWatch } = deps
  // Install the runtime's context storage once, so schema transforms can
  // propagate the SchemaContext through zod's async callbacks. The port is
  // type-erased at the runtime boundary; narrow it here to SchemaContext.
  installContextStorage(contextStorage)

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
    if (force || session === undefined) session = await loadSession(deps)
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
      deps.logger.info('building...')
      const result = await current.driver.runBuild(activeLayout)
      deps.logger.info('build finished')
      return result
    })

  const apply = async (events: FileEvent[]): Promise<BuildResult | undefined> =>
    serialize(async () => {
      const current = await ensureSession()
      const result = await current.driver.applyChanges(events)
      if (result === 'config-reload') {
        const reloaded = await ensureSession(true)
        const rebuilt = await reloaded.driver.runBuild(activeLayout)
        deps.logger.info('build finished')
        return rebuilt
      }
      if (result === 'content') {
        const rebuilt = await current.driver.runIncremental(activeLayout)
        deps.logger.info('rebuild finished')
        return rebuilt
      }
      return undefined
    })

  const watch = async (watchOptions: WatchOptions = {}, buildOptions?: BuildOptions): Promise<WatchHandle> =>
    serialize(async () => {
      // A second watch() call replaces the previous subscription instead of
      // leaking it — calling watch() twice on the same builder is unusual but
      // shouldn't strand a chokidar instance. Because the whole flow runs
      // inside the same `serialize()` critical section as `build()`/`apply()`,
      // two concurrent watch() calls can't interleave their setup either.
      closeWatch()
      const current = await ensureSession()
      if (buildOptions?.layout !== undefined) activeLayout = buildOptions.layout
      deps.logger.info(`watching for changes in '${current.config.root}'`)
      const initial = await current.driver.runBuild(activeLayout)
      const watcher = createWatch([...new Set([current.config.root, current.config.configPath, ...current.config.configDependencies])])
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
    await fs.remove(current.config.output.data, { recursive: true })
    await fs.remove(current.config.output.assets, { recursive: true })
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
