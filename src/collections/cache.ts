import type { VeliteLoader } from '../loaders/types'
import type { VeliteFile } from './file'

/**
 * Session-scoped cache of loaded files.
 *
 * Replaces the previous module-level `loadedFiles` map. Each build creates a
 * fresh cache so independent builds cannot leak file state into each other.
 */
export interface FileCache {
  get(path: string): VeliteFile | undefined
  load(path: string, loaders: VeliteLoader[]): Promise<VeliteFile>
  delete(path: string): void
  clear(): void
}

export const createFileCache = (loadFile: (path: string, loaders: VeliteLoader[]) => Promise<VeliteFile>): FileCache => {
  const cache = new Map<string, VeliteFile>()

  return {
    get(path) {
      return cache.get(path)
    },
    async load(path, loaders) {
      const existing = cache.get(path)
      if (existing != null) return existing
      const file = await loadFile(path, loaders)
      cache.set(path, file)
      return file
    },
    delete(path) {
      cache.delete(path)
    },
    clear() {
      cache.clear()
    }
  }
}
