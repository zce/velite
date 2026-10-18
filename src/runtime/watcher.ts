export type FileEvent = { type: 'add' | 'change' | 'unlink'; absPath: string }

/**
 * File event source. `subscribe` returns an unsubscribe function; `add`
 * extends the watched set after subscription (used after a config reload,
 * which may introduce new roots/dependencies the original set didn't cover).
 * Adapters without dynamic add support may omit the re-watch silently — the
 * original subscription keeps firing for everything still in it.
 */
export interface Watcher {
  subscribe(on: (event: FileEvent) => void): () => void
  /** Extend the watched paths. No-op for paths already watched. */
  add(paths: string[]): void
}
