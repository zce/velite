import { resolveConfig } from './config'
import { createDriver, createRunContext } from './driver'
import { createEngine } from './engine'
import { createLoaderRegistry } from './loader'
import { createPipeline } from './pipeline'
import { createScheduler } from './scheduler'

import type { FileSystem } from '../runtime/fs'
import type { ImageProcessor } from '../runtime/image'
import type { Logger } from '../runtime/logger'
import type { ModuleLoader } from '../runtime/modules'
import type { FileEvent, Watcher } from '../runtime/watcher'
import type { ResolvedConfig } from './config'
import type { ContentExecutionsFactory } from './content/execution/record'
import type { BuildResult, Driver, RunContext } from './driver'
import type { Engine } from './engine'
import type { Loader } from './loader'
import type { Pipeline } from './pipeline'
import type { Scheduler } from './scheduler'
import type { SchemaRunner } from './schema/runner'

export interface BuildOptions {
  /** Output layout override (default: `split` in dev, `single` in production). */
  layout?: 'split' | 'single'
}

export interface WatchOptions {
  onRebuild?(result: BuildResult): void
  /** Debounce window for merging file events (default 50ms). */
  debounceMs?: number
}

export interface WatchHandle {
  /**
   * Result of the one initial build run before the watcher subscribed. Events
   * during that initial build are not observed — the subscription starts
   * after it completes.
   */
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
  watch(watchOptions?: WatchOptions, buildOptions?: BuildOptions): Promise<WatchHandle>
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
  /** Narrow schema runner bound to the process-owned SchemaContextHost. */
  schemaRunner: SchemaRunner
  /** Record content factory bound to the same host as the schema runner. */
  contentExecutionsFactory: ContentExecutionsFactory
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
  const { fs, image, logger, modules, schemaRunner, contentExecutionsFactory } = deps
  const config = await resolveConfig({ fs, modules }, { cwd: deps.cwd, configPath: deps.configPath })
  logger.debug(`using config '${config.configPath}'`)
  const loaders = createLoaderRegistry(deps.loaders ?? [])
  const pipeline = createPipeline({ config, loaders, fs, image, schemaRunner, contentExecutionsFactory })
  const engine = createEngine()
  const context = await createRunContext({ engine, pipeline, config, runtime: { fs, logger } })
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
  const { fs, watch: createWatch } = deps

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
    // runLock is always rejection-swallowed below, so a single success
    // continuation is enough — a second handler would be dead code.
    const next = runLock.then(run)
    runLock = next.catch(() => {})
    return next
  }

  /** Load (or reload) the session. Pass `force` to replace an existing one. */
  const ensureSession = (force = false): Session | Promise<Session> => {
    if (force || session === undefined) return loadSession(deps).then(s => (session = s))
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
      deps.logger.info('building...')
      const initial = await current.driver.runBuild(activeLayout)
      deps.logger.info('build finished')
      // NOTE: the watcher subscribes only after the initial build completes,
      // so file events during that build are not observed. The next change
      // to any watched file still triggers a rebuild, and unchanged output is
      // skipped via the manifest, so the practical impact is limited to
      // edits made during the initial build window.
      const watcher = createWatch([...new Set([current.config.root, current.config.configPath, ...current.config.configDependencies])])
      const scheduler = createScheduler({
        // The scheduler discards the drain promise, so rebuild failures must be
        // handled here: a rejected `apply` (e.g. broken content after an edit)
        // must not become an unhandled rejection that kills the dev process.
        // Log it and keep watching — the next event starts a fresh rebuild.
        run: async events => {
          try {
            const result = await apply(events)
            if (result !== undefined) watchOptions.onRebuild?.(result)
          } catch (err) {
            deps.logger.error(err instanceof Error ? err.message : String(err))
          }
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

  const dispose = async (): Promise<void> =>
    // Serialized: a dispose racing an in-flight watch() setup would close the
    // (not yet existing) watcher and then let watch() install a fresh one on
    // an already-disposed builder.
    serialize(async () => {
      closeWatch()
      session = undefined
    })

  const clean = async (): Promise<void> =>
    // Serialized: clean() resets context.manifest / assetManifest — the exact
    // state the mutex exists to protect. A clean racing a build would let the
    // build re-write files the manifest no longer knows about.
    serialize(async () => {
      const current = await ensureSession()
      await fs.remove(current.config.output.data, { recursive: true })
      await fs.remove(current.config.output.assets, { recursive: true })
      // Drop the persisted manifest state too — the on-disk file was just
      // wiped, so the in-memory bookkeeping must match. Otherwise the next
      // build would try to "reconcile" files that no longer exist.
      current.context.manifest = { files: {} }
      current.context.assetManifest = new Set()
    })

  return {
    build,
    watch,
    apply,
    clean,
    dispose
  }
}
