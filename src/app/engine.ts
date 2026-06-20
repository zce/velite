import { mkdir, rm } from 'node:fs/promises'
import { normalize } from 'node:path'

import { assetStoreKey, createAssetStore } from '../assets'
import { createAssetProcessingCache } from '../assets/cache'
import { createFileCache } from '../collections/cache'
import { VeliteFile } from '../collections/file'
import { createResolver } from '../collections/resolve'
import { createConfigLoader } from '../config/load'
import { createWriter } from '../output/write'
import { logger as defaultLogger } from '../runtime/logger'
import { createSession } from '../runtime/session'
import { createBuildStore } from '../runtime/store'
import { uniqueStoreKey } from '../schemas/unique'

import type { AssetProcessingCache } from '../assets/cache'
import type { BuildResult, Collections } from '../collections'
import type { FileCache } from '../collections/cache'
import type { Resolver } from '../collections/resolve'
import type { ResolvedConfig } from '../config'
import type { ConfigLoader } from '../config/load'
import type { OutputState } from '../output/state'
import type { Writer } from '../output/write'
import type { Logger, LogLevel } from '../runtime/logger'
import type { BuildStore } from '../runtime/store'
import type { UniqueStore } from '../schemas/unique'

/**
 * Build options for `build()` and the internal engine.
 */
export interface BuildOptions {
  /**
   * Specify config file path, relative to cwd.
   * If not specified, will try to find `velite.config.{js,ts,mjs,mts,cjs,cts}`
   * in cwd or parent directories.
   */
  config?: string
  /**
   * Clean output directories before build.
   * @default false
   */
  clean?: boolean
  /**
   * Watch files and rebuild on changes.
   * @default false
   */
  watch?: boolean
  /**
   * Log level.
   * @default 'info'
   */
  logLevel?: LogLevel
  /**
   * If true, throws an error and terminates the process when any schema
   * validation fails.
   * @default false
   */
  strict?: boolean
}

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
  /**
   * Whether the given absolute path is currently tracked as a processed asset
   * source (i.e. some content file has referenced it through `s.file()` /
   * `s.image()` during a previous build).
   *
   * Intended for callers (the watcher, framework plugins) that detect changes
   * to files outside any collection pattern but inside the watch root, so they
   * can decide whether the change is relevant before issuing a rebuild.
   */
  hasAssetSource(path: string): boolean
  /**
   * Invalidate the asset-processing cache entries for `path` and drop the
   * file-cache entries of every owner that previously referenced it. Returns
   * the list of owner content paths so the caller can immediately schedule a
   * targeted `rebuild({ event: 'change', paths: owners })`.
   *
   * Intended for callers (the watcher, framework plugins) that detect changes
   * outside any collection pattern but to a previously-processed asset source.
   */
  invalidateAssetSource(path: string): string[]
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

interface IncrementalState {
  files: FileCache
  resolved: Map<string, VeliteFile[]>
  assets: AssetProcessingCache
  store: BuildStore
}

const createIncrementalState = (): IncrementalState => ({
  files: createFileCache((path, loaders) => VeliteFile.create(path, loaders)),
  resolved: new Map(),
  assets: createAssetProcessingCache(),
  store: createBuildStore()
})

export const createEngine = <T extends Collections = Collections>({
  loader = createConfigLoader(),
  resolver = createResolver(),
  writer = createWriter(),
  logger = defaultLogger
}: EngineOptions = {}): Engine<T> => {
  let currentConfig: ResolvedConfig<T> | undefined
  let currentOptions: BuildOptions = {}
  const outputState: OutputState = { emitted: new Map() }
  let incremental = createIncrementalState()
  const clearIncremental = () => {
    incremental.files.clear()
    incremental.resolved.clear()
    incremental.assets.clear()
    incremental.store = createBuildStore()
  }

  const runResolve = async (config: ResolvedConfig<T>, options: BuildOptions, change?: RebuildChange): Promise<BuildResult<T>> => {
    if (change != null) {
      const uniqueStore = incremental.store.get<UniqueStore>(uniqueStoreKey)
      for (const path of change.paths) {
        const normalized = normalize(path)
        incremental.files.delete(normalized)
        uniqueStore?.invalidate(normalized)
      }
    }
    const session = createSession(config, options, {
      output: outputState,
      logger,
      files: incremental.files,
      resolved: incremental.resolved,
      store: incremental.store,
      assetCache: incremental.assets
    })
    const { result } = await resolver.resolve(session, change)

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
        clearIncremental()

        if (config.output.clean) {
          await rm(config.output.data, { recursive: true, force: true })
          logger.log(`cleaned data output dir '${config.output.data}'`)
          await rm(config.output.assets, { recursive: true, force: true })
          logger.log(`cleaned assets output dir '${config.output.assets}'`)
          outputState.emitted.clear()
        }

        await mkdir(config.output.data, { recursive: true })
        await mkdir(config.output.assets, { recursive: true })

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
      if (change == null) clearIncremental()
      await mkdir(currentConfig.output.data, { recursive: true })
      await mkdir(currentConfig.output.assets, { recursive: true })
      await writer.writeEntry(outputState, currentConfig.output.data, currentConfig.output.format, currentConfig.configPath, currentConfig.collections)
      const result = await runResolve(currentConfig, currentOptions, change)
      logger.info('rebuild finished', begin)
      return result
    },

    hasAssetSource(path: string) {
      return incremental.assets.hasSource(path)
    },

    invalidateAssetSource(path: string) {
      const owners = incremental.assets.invalidateSource(path)
      for (const owner of owners) incremental.files.delete(owner)
      return owners
    }
  }
}
