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

const loadSession = async (runtime: Runtime, options: CreateBuilderOptions): Promise<Session> => {
  const config = await resolveConfig(runtime, { cwd: options.cwd, configPath: options.configPath })
  const engine = createEngine()
  const pipeline = createPipeline(config, createLoaderRegistry(options.loaders ?? []), runtime.image)
  const context = createRunContext(engine, pipeline, config, runtime)
  return { config, engine, pipeline, context }
}

/**
 * Composition root (Pure DI): assembles runtime + config + engine + pipeline into a
 * Builder. No DI framework — the Runtime object is the container, wired here.
 */
export const createBuilder = (runtime: Runtime, options: CreateBuilderOptions): Builder => {
  let session: Session | undefined
  let scheduler: Scheduler | undefined
  let unsubscribe: (() => void) | undefined
  // Active output layout — sticky from the first build() so incremental/watch
  // rebuilds stay consistent. Core never reads process.env; the root entry
  // (src/index.ts) decides the env-based default and passes it via BuildOptions.
  let activeLayout: 'split' | 'single' = 'split'

  const init = async (): Promise<Session> => {
    if (session !== undefined) return session
    session = await loadSession(runtime, options)
    return session
  }

  const reload = async (): Promise<Session> => {
    session = await loadSession(runtime, options)
    return session
  }

  const build = async (buildOptions?: BuildOptions): Promise<BuildResult> => {
    const current = await init()
    if (buildOptions?.layout !== undefined) activeLayout = buildOptions.layout
    return runBuild(current.context, activeLayout)
  }

  const apply = async (events: FileEvent[]): Promise<BuildResult | undefined> => {
    const current = await init()
    const result = await applyChanges(current.context, events, {
      cwd: options.cwd,
      configPath: current.config.configPath
    })
    if (result === 'config-reload') {
      session = await reload()
      return runBuild(session.context, activeLayout)
    }
    if (result === 'content') return runIncremental(current.context, activeLayout)
    return undefined
  }

  const watch = async (watchOptions: WatchOptions = {}): Promise<WatchHandle> => {
    if (runtime.watch === undefined) {
      throw new Error('watch is not available: runtime has no watch factory')
    }
    await build()
    const current = session!
    const watcher = runtime.watch!([current.config.root, current.config.configPath])
    scheduler = createScheduler(async events => {
      const result = await apply(events)
      if (result !== undefined) watchOptions.onRebuild?.(result)
    }, watchOptions.debounceMs)
    unsubscribe = watcher.subscribe(event => scheduler!.push([event]))
    return {
      close: async () => {
        scheduler?.dispose()
        scheduler = undefined
        unsubscribe?.()
        unsubscribe = undefined
      }
    }
  }

  const dispose = async () => {
    scheduler?.dispose()
    unsubscribe?.()
    session = undefined
  }

  return {
    build,
    watch,
    applyChanges: apply,
    dispose
  }
}
