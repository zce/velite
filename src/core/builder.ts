import { resolveConfig } from './config'
import { applyChanges, createRunContext, runBuild, runIncremental } from './driver'
import { createEngine } from './engine'
import { createLoaderRegistry } from './loader'
import { createPipeline } from './pipeline'
import { createScheduler } from './scheduler'

import type { Runtime } from '../runtime'
import type { FileEvent } from '../runtime/watcher'
import type { ResolvedConfig } from './config'
import type { BuildResult, RunContext } from './driver'
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
  close(): Promise<void>
}

/** The durable build instance. Holds the engine (= incremental database). */
export interface Builder {
  build(options?: BuildOptions): Promise<BuildResult>
  watch(options?: WatchOptions): Promise<WatchHandle>
  applyChanges(events: FileEvent[]): Promise<BuildResult | undefined>
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

interface Session {
  config: ResolvedConfig
  engine: Engine
  pipeline: Pipeline
  context: RunContext
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
  const engine = createEngine()
  const pipeline = createPipeline(config, createLoaderRegistry(options.loaders ?? []), runtime.image, runtime.fs)
  const context = createRunContext(engine, pipeline, config, runtime)
  return { config, engine, pipeline, context }
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
export const createBuilder = (runtime: Runtime, options: CreateBuilderOptions): Builder => {
  let session: Session | undefined
  let activeLayout: 'split' | 'single' = 'split'
  let watchState: WatchState | undefined

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

  const build = async (buildOptions?: BuildOptions): Promise<BuildResult> => {
    const current = await ensureSession()
    if (buildOptions?.layout !== undefined) activeLayout = buildOptions.layout
    return runBuild(current.context, activeLayout)
  }

  const apply = async (events: FileEvent[]): Promise<BuildResult | undefined> => {
    const current = await ensureSession()
    const result = await applyChanges(current.context, events, {
      cwd: options.cwd,
      configPath: current.config.configPath
    })
    if (result === 'config-reload') {
      const reloaded = await ensureSession(true)
      return runBuild(reloaded.context, activeLayout)
    }
    if (result === 'content') return runIncremental(current.context, activeLayout)
    return undefined
  }

  const watch = async (watchOptions: WatchOptions = {}): Promise<WatchHandle> => {
    if (runtime.watch === undefined) {
      throw new Error('watch is not available: runtime has no watch support')
    }
    // A second watch() call replaces the previous subscription instead of
    // leaking it — calling watch() twice on the same builder is unusual but
    // shouldn't strand a chokidar instance.
    closeWatch()
    await build()
    const current = session!
    const watcher = runtime.watch([current.config.root, current.config.configPath])
    const scheduler = createScheduler(async events => {
      const result = await apply(events)
      if (result !== undefined) watchOptions.onRebuild?.(result)
    }, watchOptions.debounceMs)
    const unsubscribe = watcher.subscribe(event => scheduler.push([event]))
    watchState = { scheduler, unsubscribe }
    return {
      close: async () => closeWatch()
    }
  }

  const dispose = async (): Promise<void> => {
    closeWatch()
    session = undefined
  }

  const clean = async (): Promise<void> => {
    const current = await ensureSession()
    await runtime.fs.remove(current.config.output.data, { recursive: true })
    await runtime.fs.remove(current.config.output.assets, { recursive: true })
  }

  return {
    build,
    watch,
    applyChanges: apply,
    clean,
    dispose
  }
}
