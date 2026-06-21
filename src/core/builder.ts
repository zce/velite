import { resolveConfig, validateConfig } from './config'
import { type Diagnostic } from './diagnostic'
import { applyChanges, createRunContext, defaultLayout, runBuild, runIncremental } from './driver'
import { createEngine } from './engine'
import { createLoaderRegistry } from './loader'
import { createPipeline } from './pipeline'
import { createScheduler } from './scheduler'

import type { ResolvedConfig } from './config'
import type { BuildResult, RunContext } from './driver'
import type { Engine } from './engine'
import type { Host } from './host'
import type { FileEvent } from './host/watcher'
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
  dispose(): void
}

export interface CreateBuilderOptions {
  cwd: string
  configPath: string
  loaders?: Loader[]
}

class ConfigError extends Error {
  constructor(readonly diagnostics: Diagnostic[]) {
    super(diagnostics.map(d => d.message).join('; '))
    this.name = 'ConfigError'
  }
}

interface Session {
  config: ResolvedConfig
  engine: Engine
  pipeline: Pipeline
  context: RunContext
}

const loadSession = async (host: Host, options: CreateBuilderOptions): Promise<Session> => {
  const loaded = await host.config.load(options.configPath)
  const issues = validateConfig(loaded.config)
  if (issues.length > 0) throw new ConfigError(issues)
  const config = resolveConfig(loaded.config as never, { cwd: options.cwd, path: host.path, configPath: options.configPath })
  const engine = createEngine()
  const pipeline = createPipeline(config, createLoaderRegistry(options.loaders ?? []), host)
  const context = createRunContext(engine, pipeline, config, host)
  return { config, engine, pipeline, context }
}

/**
 * Composition root (Pure DI): assembles host + config + engine + pipeline into a
 * Builder. No DI framework — the Host object is the container, wired here.
 */
export const createBuilder = (host: Host, options: CreateBuilderOptions): Builder => {
  let session: Session | undefined
  let scheduler: Scheduler | undefined
  let unsubscribe: (() => void) | undefined

  const init = async (): Promise<Session> => {
    if (session !== undefined) return session
    session = await loadSession(host, options)
    return session
  }

  const reload = async (): Promise<Session> => {
    session = await loadSession(host, options)
    return session
  }

  const build = async (buildOptions?: BuildOptions): Promise<BuildResult> => {
    const current = await init()
    return runBuild(current.context, buildOptions?.layout ?? defaultLayout())
  }

  const apply = async (events: FileEvent[]): Promise<BuildResult | undefined> => {
    const current = await init()
    const result = await applyChanges(current.context, events, {
      cwd: options.cwd,
      configPath: options.configPath
    })
    if (result === 'config-reload') {
      session = await reload()
      return runBuild(session.context, defaultLayout())
    }
    if (result === 'content') return runIncremental(current.context, defaultLayout())
    return undefined
  }

  const watch = async (watchOptions: WatchOptions = {}): Promise<WatchHandle> => {
    if (host.watch === undefined) {
      throw new Error('watch is not available: host has no watch factory')
    }
    await build()
    const current = session!
    const watcher = host.watch!([current.config.root, options.configPath])
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

  return {
    build,
    watch,
    applyChanges: apply,
    dispose() {
      scheduler?.dispose()
      unsubscribe?.()
      session = undefined
    }
  }
}
