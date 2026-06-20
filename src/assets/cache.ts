import type { ImageData } from './image'

/** Cached result of processing a single asset reference. */
export interface CachedAssetProcessResult {
  readonly sourcePath: string
  readonly outputName: string
  readonly fingerprint: string
  readonly publicUrl: string
  readonly image?: Omit<ImageData, 'src'>
}

/**
 * Internal cache for `processAsset` results.
 *
 * Keyed by a stable serialization of the inputs so repeated references to the
 * same asset across owners share a single read/hash/sharp pipeline. The cache
 * also tracks which content files (owners) referenced which source paths, so
 * watch mode can invalidate the right entries when a source asset changes.
 */
export interface AssetProcessingCache {
  getOrCreate(key: string, sourcePath: string, factory: () => Promise<CachedAssetProcessResult>): Promise<CachedAssetProcessResult>
  recordOwner(sourcePath: string, ownerPath: string): void
  invalidateSource(sourcePath: string): string[]
  hasSource(sourcePath: string): boolean
  clear(): void
}

/** Inputs that uniquely identify a `processAsset` invocation result. */
export interface AssetProcessKeyInput {
  sourcePath: string
  filename: string
  baseUrl: string
  suffix: string
  isImage: boolean
  blurOptions?: unknown
}

/** Build a stable cache key for `processAsset` inputs. */
export const createAssetProcessKey = (input: AssetProcessKeyInput): string =>
  JSON.stringify({
    sourcePath: input.sourcePath,
    filename: input.filename,
    baseUrl: input.baseUrl,
    suffix: input.suffix,
    isImage: input.isImage,
    blurOptions: input.blurOptions ?? null
  })

/** Create an in-memory asset processing cache. */
export const createAssetProcessingCache = (): AssetProcessingCache => {
  const entries = new Map<string, Promise<CachedAssetProcessResult>>()
  const sourceKeys = new Map<string, Set<string>>()
  const owners = new Map<string, Set<string>>()

  return {
    getOrCreate(key, sourcePath, factory) {
      const existing = entries.get(key)
      if (existing != null) return existing
      const value = factory()
      entries.set(key, value)
      const keys = sourceKeys.get(sourcePath) ?? new Set<string>()
      keys.add(key)
      sourceKeys.set(sourcePath, keys)
      value.then(
        () => {},
        () => {
          if (entries.get(key) === value) {
            entries.delete(key)
            const current = sourceKeys.get(sourcePath)
            if (current != null) {
              current.delete(key)
              if (current.size === 0) sourceKeys.delete(sourcePath)
            }
          }
        }
      )
      return value
    },
    recordOwner(sourcePath, ownerPath) {
      let set = owners.get(sourcePath)
      if (set == null) {
        set = new Set()
        owners.set(sourcePath, set)
      }
      set.add(ownerPath)
    },
    invalidateSource(sourcePath) {
      const previousOwners = owners.get(sourcePath)
      const result = previousOwners == null ? [] : Array.from(previousOwners)
      const keys = sourceKeys.get(sourcePath)
      if (keys != null) {
        for (const key of keys) entries.delete(key)
        sourceKeys.delete(sourcePath)
      }
      owners.delete(sourcePath)
      return result
    },
    hasSource(sourcePath) {
      return owners.has(sourcePath)
    },
    clear() {
      entries.clear()
      sourceKeys.clear()
      owners.clear()
    }
  }
}
