import { createAssetProcessingCache } from '../assets/cache'
import { createFileCache } from '../collections/cache'
import { loadFile } from '../collections/file'
import { silentLogger } from '../runtime/logger'
import { createEffectIndex } from '../schemas/effects'
import { createCacheRegistry } from './cache'
import { createDependencyGraph } from './graph'
import { createSessionStore } from './store'

import type { AssetProcessingCache } from '../assets/cache'
import type { FileCache } from '../collections/cache'
import type { Logger } from '../runtime/logger'
import type { EffectIndex } from '../schemas/effects'
import type { CacheRegistry } from './cache'
import type { Diagnostic } from './errors'
import type { DependencyGraph } from './graph'
import type { Project } from './project'
import type { Snapshot } from './snapshot'

/**
 * Public, session-scoped store for advanced custom schemas.
 *
 * The store belongs to a `Session`: it is shared across rebuilds inside a watch
 * session, destroyed at the end of a one-shot build, and reset on config
 * reload. It never persists across processes.
 *
 * 1.0 deliberately does not expose `set()`: built-in cross-file schemas use the
 * internal schema-effects model instead of mutating shared state directly, so
 * concurrency stays deterministic. `getOrCreate` is the only lazy mutation
 * path available to user schemas.
 */
export interface SessionStore {
  get<T>(key: string | symbol): T | undefined
  has(key: string | symbol): boolean
  getOrCreate<T>(key: string | symbol, create: () => T): T
}

/** A build session: the state container shared by one or more build runs. */
export interface Session<T extends Project = Project> {
  readonly project: T | undefined
  readonly store: SessionStore
  /** Committed dependency graph. Replaced atomically on a successful build run. */
  graph: DependencyGraph
  readonly cache: CacheRegistry
  readonly files: FileCache
  readonly assetCache: AssetProcessingCache
  /** Committed schema effect index. Replaced atomically on a successful build run. */
  effectIndex: EffectIndex
  readonly output: OutputState
  readonly logger: Logger
  /** Latest diagnostics from the most recent build run (success or failure). */
  diagnostics: Diagnostic[]
  /** Last successful build snapshot, or `undefined` before the first success. */
  snapshot: Snapshot | undefined
}

/** Track content already written to disk so unchanged outputs are skipped. */
export interface OutputState {
  /** Map from output path to the most recently emitted content. */
  emitted: Map<string, string>
}

export interface CreateSessionOptions {
  project?: Project
  logger?: Logger
  /** Shared output state, e.g. across watch rebuilds. */
  output?: OutputState
  /** Shared file cache for one session lifetime. */
  files?: FileCache
  /** Shared asset processing cache for one session lifetime. */
  assetCache?: AssetProcessingCache
}

/**
 * Create a fresh build session.
 *
 * With no arguments a bare, isolated session is created (used by unit tests).
 * The engine passes a resolved `Project` plus shared caches for watch rebuilds.
 * Sessions are never reused across independent builds.
 */
export const createSession = <T extends Project = Project>(options: CreateSessionOptions = {}): Session<T> => ({
  project: options.project as T | undefined,
  store: createSessionStore(),
  graph: createDependencyGraph(),
  cache: createCacheRegistry(),
  files: options.files ?? createFileCache((path, loaders, sourceId) => loadFile(path, loaders, sourceId)),
  assetCache: options.assetCache ?? createAssetProcessingCache(),
  effectIndex: createEffectIndex(),
  output: options.output ?? { emitted: new Map() },
  logger: options.logger ?? silentLogger,
  diagnostics: [],
  snapshot: undefined
})
