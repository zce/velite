export type FileEvent = { type: 'add' | 'change' | 'unlink'; absPath: string }

/** File event source. `subscribe` returns an unsubscribe function. */
export interface Watcher {
  subscribe(on: (event: FileEvent) => void): () => void
}
