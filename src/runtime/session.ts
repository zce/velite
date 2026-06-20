import { createAssetProcessingCache } from '../assets/cache'
import { createFileCache } from '../collections/cache'
import { VeliteFile } from '../collections/file'
import { logger as defaultLogger } from './logger'
import { createBuildStore } from './store'

import type { BuildOptions } from '../app/engine'
import type { AssetProcessingCache } from '../assets/cache'
import type { Collections } from '../collections'
import type { FileCache } from '../collections/cache'
import type { ResolvedConfig } from '../config'
import type { VeliteLoader } from '../loaders/types'
import type { OutputState } from '../output/state'
import type { Logger } from './logger'
import type { BuildStore } from './store'

/**
 * All build-scoped mutable state owned by a single build.
 *
 * A new session is created for every `build()` and `rebuild()`. Sessions are
 * never reused across independent builds.
 */
export interface BuildSession<T extends Collections = Collections> {
  readonly config: ResolvedConfig<T>
  readonly options: BuildOptions
  readonly files: FileCache
  readonly resolved: Map<string, VeliteFile[]>
  readonly store: BuildStore
  readonly output: OutputState
  readonly logger: Logger
  readonly assetCache: AssetProcessingCache
}

const defaultLoadFile = (path: string, loaders: VeliteLoader[]): Promise<VeliteFile> => VeliteFile.create(path, loaders)

export interface CreateSessionOptions {
  /** Shared output state, e.g. across watch rebuilds. */
  output?: OutputState
  /** Shared file cache for one engine lifetime. */
  files?: FileCache
  /** Shared resolved collection cache for one engine lifetime. */
  resolved?: Map<string, VeliteFile[]>
  /** Shared build store for one engine lifetime. When omitted, a fresh store is created per session. */
  store?: BuildStore
  /** Override the session logger. Defaults to the process-level logger. */
  logger?: Logger
  /** Shared asset processing cache for one engine lifetime. */
  assetCache?: AssetProcessingCache
}

/**
 * Create a fresh build session.
 *
 * `output`, `files`, `resolved`, `store`, and `assetCache` may be supplied so
 * a long-lived engine can share state across rebuilds. When omitted, every
 * session starts with fresh caches.
 */
export const createSession = <T extends Collections>(
  config: ResolvedConfig<T>,
  options: BuildOptions,
  sessionOptions: CreateSessionOptions = {}
): BuildSession<T> => ({
  config,
  options,
  files: sessionOptions.files ?? createFileCache(defaultLoadFile),
  resolved: sessionOptions.resolved ?? new Map(),
  store: sessionOptions.store ?? createBuildStore(),
  output: sessionOptions.output ?? { emitted: new Map() },
  logger: sessionOptions.logger ?? defaultLogger,
  assetCache: sessionOptions.assetCache ?? createAssetProcessingCache()
})
