import { VeliteFile } from './file'
import { createFileCache } from './file-cache'
import { createLogger, logger as defaultLogger } from './logger'
import { createOutputState } from './output-state'
import { createSessionStore } from './store'

import type { Config } from '../config'
import type { Loader } from '../loaders/types'
import type { FileCache } from './file-cache'
import type { Logger } from './logger'
import type { OutputState } from './output-state'
import type { SessionStore } from './store'
import type { Options } from './types'

/**
 * All build-scoped mutable state owned by a single build.
 *
 * A new session is created for every `build()` and `rebuild()`. Sessions are
 * never reused across independent builds.
 */
export interface BuildSession {
  readonly config: Config
  readonly options: Options
  readonly files: FileCache
  readonly resolved: Map<string, VeliteFile[]>
  readonly store: SessionStore
  readonly output: OutputState
  readonly logger: Logger
}

const defaultLoadFile = (path: string, loaders: Loader[]): Promise<VeliteFile> => VeliteFile.create(path, loaders)

export interface CreateSessionOptions {
  /** Shared output state, e.g. across watch rebuilds. */
  output?: OutputState
  /** Override the session logger. Defaults to the process-level logger. */
  logger?: Logger
}

/**
 * Create a fresh build session.
 *
 * `output` may be supplied to share an emit cache across watch rebuilds. When
 * omitted, every session starts with an empty output cache.
 *
 * `logger` may be supplied to redirect log output (e.g. for tests). When
 * omitted, the process-level logger is used.
 */
export const createSession = (config: Config, options: Options, sessionOptions: CreateSessionOptions = {}): BuildSession => ({
  config,
  options,
  files: createFileCache(defaultLoadFile),
  resolved: new Map(),
  store: createSessionStore(),
  output: sessionOptions.output ?? createOutputState(),
  logger: sessionOptions.logger ?? defaultLogger
})

// Re-export so engine code can construct a per-session logger when desired.
export { createLogger }
