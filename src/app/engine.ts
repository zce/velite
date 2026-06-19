import { mkdir, rm } from 'node:fs/promises'

import { assetStoreKey, createAssetStore } from '../assets'
import { createResolver } from '../collections/resolve'
import { createConfigLoader } from '../config/load'
import { createOutputState } from '../output/state'
import { createWriter } from '../output/write'
import { logger as defaultLogger } from '../runtime/logger'
import { createSession } from '../runtime/session'

import type { Resolver } from '../collections/resolve'
import type { Config } from '../config'
import type { ConfigLoader } from '../config/load'
import type { Writer } from '../output/write'
import type { Logger } from '../runtime/logger'
import type { Options } from './types'

export interface Engine {
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
export interface EngineOptions {
  loader?: ConfigLoader
  resolver?: Resolver
  writer?: Writer
  logger?: Logger
}

export const createEngine = ({
  loader = createConfigLoader(),
  resolver = createResolver(),
  writer = createWriter(),
  logger = defaultLogger
}: EngineOptions = {}): Engine => {
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
    const session = createSession(config, options, { output: outputState, logger })
    const { result } = await resolver.resolve(session)

    const hookContext = { config }
    let shouldOutput = true
    if (typeof config.prepare === 'function') {
      const begin = performance.now()
      shouldOutput = ((await config.prepare(result as never, hookContext)) ?? true) as boolean
      logger.log(`executed 'prepare' callback got ${shouldOutput}`, begin)
    }

    if (shouldOutput) {
      await writer.writeData(session.output, config.output.data, result)
    } else {
      logger.warn(`prevent output by 'prepare' callback`)
    }

    await writer.writeAssets(session.output, config.output.assets, session.store.getOrCreate(assetStoreKey, createAssetStore))

    if (typeof config.complete === 'function') {
      const begin = performance.now()
      await config.complete(result as never, hookContext)
      logger.log(`executed 'complete' callback`, begin)
    }

    return result
  }

  return {
    get config() {
      return currentConfig
    },

    async build(options = {}) {
      const begin = performance.now()
      const timer = setTimeout(() => logger.info('building...'), 1000)

      try {
        if (options.logLevel != null) logger.set(options.logLevel)

        const config = await loader.load(options.config, {
          clean: options.clean,
          strict: options.strict
        })
        currentConfig = config
        currentOptions = options

        if (config.output.clean) {
          await rm(config.output.data, { recursive: true, force: true })
          logger.log(`cleaned data output dir '${config.output.data}'`)
          await rm(config.output.assets, { recursive: true, force: true })
          logger.log(`cleaned assets output dir '${config.output.assets}'`)
          // After clean, drop the emit cache so the next write actually writes.
          outputState.emitted.clear()
        }

        await ensureOutputDirs(config)

        await writer.writeEntry(outputState, config.output.data, config.output.format, config.configPath, config.collections)

        logger.log('initialized', begin)
        const result = await runResolve(config, options)
        logger.info('build finished', begin)
        return result
      } finally {
        clearTimeout(timer)
      }
    },

    async rebuild() {
      if (currentConfig == null) throw new Error('rebuild() called before build()')
      const begin = performance.now()
      logger.info('rebuilding...')
      await ensureOutputDirs(currentConfig)
      await writer.writeEntry(outputState, currentConfig.output.data, currentConfig.output.format, currentConfig.configPath, currentConfig.collections)
      const result = await runResolve(currentConfig, currentOptions)
      logger.info('rebuild finished', begin)
      return result
    }
  }
}
