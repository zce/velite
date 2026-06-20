import type { Loader } from '../loaders/types'
import type { LoadedFile } from './file'

/**
 * Session-scoped cache of loaded files.
 *
 * Replaces any module-level file map. Each session owns its own cache so
 * independent builds cannot leak file state into each other. The cache
 * deduplicates concurrent loads of the same path.
 */
export interface FileCache {
  get(path: string): LoadedFile | undefined
  load(path: string, loaders: readonly Loader[], sourceId: string): Promise<LoadedFile>
  delete(path: string): void
  clear(): void
}

export const createFileCache = (loadFile: (path: string, loaders: readonly Loader[], sourceId: string) => Promise<LoadedFile>): FileCache => {
  const cache = new Map<string, LoadedFile>()
  const pending = new Map<string, Promise<LoadedFile>>()

  return {
    get(path) {
      return cache.get(path)
    },
    async load(path, loaders, sourceId) {
      const existing = cache.get(path)
      if (existing != null) return existing
      const inflight = pending.get(path)
      if (inflight != null) return inflight
      const promise = loadFile(path, loaders, sourceId)
        .then(file => {
          cache.set(path, file)
          pending.delete(path)
          return file
        })
        .catch(err => {
          pending.delete(path)
          throw err
        })
      pending.set(path, promise)
      const file = await promise
      cache.set(path, file)
      return file
    },
    delete(path) {
      cache.delete(path)
      pending.delete(path)
    },
    clear() {
      cache.clear()
      pending.clear()
    }
  }
}
