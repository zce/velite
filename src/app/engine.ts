import { mkdir, rm } from 'node:fs/promises'

import { assetStoreKey, createAssetStore } from '../assets'
import { createResolver } from '../collections/resolve'
import { createConfigLoader } from '../config/load'
import { createOutputState } from '../output/state'
import { createWriter } from '../output/write'
import { logger as defaultLogger } from '../runtime/logger'
import { createSession } from '../runtime/session'

import type { BuildResult, Collections } from '../collections'
import type { Resolver } from '../collections/resolve'
import type { ResolvedConfig } from '../config'
import type { ConfigLoader } from '../config/load'
import type { Writer } from '../output/write'
import type { Logger } from '../runtime/logger'
import type { BuildOptions } from './types'

/**
 * Filesystem change classification consumed by `Engine.rebuild`.
 *
 * Callers must pre-map platform-specific events (for example chokidar
 * `addDir` / `unlinkDir`) to one of these values before calling rebuild.
 */
export type RebuildEvent = 'add' | 'change' | 'unlink'

export interface RebuildChange {
  readonly event: RebuildEvent
  readonly paths: readonly string[]
}

export interface Engine<T extends Collections = Collections> {
  /**
   * Run a full build: load config, write entry, resolve content, write data
   * and assets, and call hooks.
   */
  build(options?: BuildOptions): Promise<BuildResult<T>>
  /**
   * Re-run using the current config and engine-scoped incremental state.
   *
   * `change` is optional so callers can request a full rebuild through the same
   * long-lived engine. Watch mode, framework plugins, and future programmatic
   * integrations should all use this core Engine capability instead of owning
   * separate incremental caches.
   */
  rebuild(change?: RebuildChange): Promise<BuildResult<T>>
  /** Last successfully resolved config, available after `build()` completes. */
  readonly config: ResolvedConfig<T> | undefined
}

/**
 * Create a build engine.
 *
 * The engine owns:
 *   - a single `ConfigLoader` reused across reloads,
 *   - the most recently resolved `ResolvedConfig`,
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

export const createEngine = <T extends Collections = Collections>({
  loader = createConfigLoader(),
  resolver = createResolver(),
  writer = createWriter(),
  logger = defaultLogger
}: EngineOptions = {}): Engine<T> => {
  let currentConfig: ResolvedConfig<T> | undefined
  let currentOptions: BuildOptions = {}
  // Long-lived emit cache shared across rebuilds within the same engine.
  // A fresh build() with `clean: true` clears the cache implicitly because the
  // output directory is removed; otherwise content-based skipping still works.
  const outputState = createOutputState()

  const ensureOutputDirs = async (config: ResolvedConfig<T>): Promise<void> => {
    await mkdir(config.output.data, { recursive: true })
    await mkdir(config.output.assets, { recursive: true })
  }

  const runResolve = async (config: ResolvedConfig<T>, options: BuildOptions): Promise<BuildResult<T>> => {
    const session = createSession(config, options, { output: outputState, logger })
    const { result } = await resolver.resolve(session)

    const hookContext = { config }
    let shouldOutput = true
    if (typeof config.prepare === 'function') {
      const begin = performance.now()
      shouldOutput = ((await config.prepare(result, hookContext)) ?? true) as boolean
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
      await config.complete(result, hookContext)
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

      if (options.logLevel != null) logger.set(options.logLevel)

      const timer = setTimeout(() => logger.info('building...'), 1000)

      try {
        const config = await loader.load<T>(options.config, {
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

    async rebuild(change?: RebuildChange) {
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
