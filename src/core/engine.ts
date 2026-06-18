import { mkdir, rm } from 'node:fs/promises'

import { assetStoreKey } from './assets'
import { createConfigLoader } from './config'
import { createDiscoverer } from './discover'
import { logger as defaultLogger } from './logger'
import { createOutputWriter } from './output'
import { createOutputState } from './output-state'
import { createContentResolver } from './resolver'
import { createSession } from './session'

import type { Config } from '../config'
import type { ConfigLoader } from './config'
import type { Logger } from './logger'
import type { OutputWriter } from './output'
import type { OutputState } from './output-state'
import type { ContentResolver } from './resolver'
import type { Options } from './types'

export interface BuildEngine {
  /**
   * Run a full build: load config, write entry, resolve content, write data
   * and assets, and call hooks.
   */
  build(options?: Options): Promise<Record<string, unknown>>
  /**
   * Re-run a build using the engine's current resolved config. Does not
   * reload config and does not honor `output.clean`. Output directories are
   * still ensured to exist before writing, and entry files are restored if
   * they were deleted between rebuilds.
   */
  rebuild(): Promise<Record<string, unknown>>
  /** Last successfully resolved config, available after `build()` completes. */
  readonly config: Config | undefined
}

export interface BuildEngineDeps {
  configLoader: ConfigLoader
  resolver: ContentResolver
  /**
   * Factory for an output writer bound to the supplied output state.
   *
   * The default implementation calls `createOutputWriter(state)` with the
   * production filesystem.
   */
  createWriter: (state: OutputState) => OutputWriter
  /**
   * Logger used by the engine itself for orchestration messages. Sessions
   * receive their own logger instance through `createSession()`; this one is
   * only for build-level lifecycle logs.
   */
  logger: Logger
}

const buildDefaultDeps = (): BuildEngineDeps => ({
  configLoader: createConfigLoader(),
  resolver: createContentResolver({ discoverer: createDiscoverer() }),
  createWriter: state => createOutputWriter(state),
  logger: defaultLogger
})

/**
 * Create a build engine.
 *
 * The engine owns:
 *   - a single `ConfigLoader` reused across reloads,
 *   - the most recently resolved `Config`,
 *   - a process-lifetime emit cache shared across rebuilds within the same
 *     watch session.
 *
 * It does not own a `BuildSession`; each `build()` and `rebuild()` creates a
 * fresh session that lives only for the duration of the call.
 */
export const createBuildEngine = (deps: BuildEngineDeps = buildDefaultDeps()): BuildEngine => {
  let currentConfig: Config | undefined
  let currentOptions: Options = {}
  // Long-lived emit cache shared across rebuilds within the same engine.
  // A fresh build() with `clean: true` clears the cache implicitly because the
  // output directory is removed; otherwise content-based skipping still works.
  const outputState = createOutputState()

  const ensureOutputDirs = async (config: Config): Promise<void> => {
    await mkdir(config.output.data, { recursive: true })
    await mkdir(config.output.assets, { recursive: true })
  }

  const runResolve = async (config: Config, options: Options): Promise<Record<string, unknown>> => {
    const session = createSession(config, options, { output: outputState, logger: deps.logger })
    const writer = deps.createWriter(session.output)

    const { result } = await deps.resolver.resolve(session)

    const hookContext = { config }
    let shouldOutput = true
    if (typeof config.prepare === 'function') {
      const begin = performance.now()
      shouldOutput = ((await config.prepare(result as never, hookContext)) ?? true) as boolean
      deps.logger.log(`executed 'prepare' callback got ${shouldOutput}`, begin)
    }

    if (shouldOutput) {
      await writer.writeData(config.output.data, result)
    } else {
      deps.logger.warn(`prevent output by 'prepare' callback`)
    }

    await writer.writeAssets(config.output.assets, session.store.get(assetStoreKey))

    if (typeof config.complete === 'function') {
      const begin = performance.now()
      await config.complete(result as never, hookContext)
      deps.logger.log(`executed 'complete' callback`, begin)
    }

    return result
  }

  return {
    get config() {
      return currentConfig
    },

    async build(options = {}) {
      const begin = performance.now()
      const timer = setTimeout(() => deps.logger.info('building...'), 1000)

      try {
        if (options.logLevel != null) deps.logger.set(options.logLevel)

        const config = await deps.configLoader.load(options.config, {
          clean: options.clean,
          strict: options.strict
        })
        currentConfig = config
        currentOptions = options

        if (config.output.clean) {
          await rm(config.output.data, { recursive: true, force: true })
          deps.logger.log(`cleaned data output dir '${config.output.data}'`)
          await rm(config.output.assets, { recursive: true, force: true })
          deps.logger.log(`cleaned assets output dir '${config.output.assets}'`)
          // After clean, drop the emit cache so the next write actually writes.
          outputState.emitted.clear()
        }

        await ensureOutputDirs(config)

        const writer = deps.createWriter(outputState)
        await writer.writeEntry(config.output.data, config.output.format, config.configPath, config.collections)

        deps.logger.log('initialized', begin)
        const result = await runResolve(config, options)
        deps.logger.info('build finished', begin)
        return result
      } finally {
        clearTimeout(timer)
      }
    },

    async rebuild() {
      if (currentConfig == null) throw new Error('rebuild() called before build()')
      const begin = performance.now()
      deps.logger.info('rebuilding...')
      await ensureOutputDirs(currentConfig)
      const writer = deps.createWriter(outputState)
      await writer.writeEntry(currentConfig.output.data, currentConfig.output.format, currentConfig.configPath, currentConfig.collections)
      const result = await runResolve(currentConfig, currentOptions)
      deps.logger.info('rebuild finished', begin)
      return result
    }
  }
}
