import type { BlurOptions, VeliteImage } from './image'

/** Cached result of processing a single asset reference. */
export interface CachedAssetProcessResult {
  readonly sourcePath: string
  readonly outputName: string
  readonly fingerprint: string
  readonly publicUrl: string
  readonly image?: Omit<VeliteImage, 'src'>
}

/**
 * Internal cache for `processAsset` results.
 *
 * Keyed by a stable JSON serialization of the inputs so that repeated
 * references to the same asset across owners share a single read/hash/sharp
 * pipeline. The cache also tracks which content files (owners) have referenced
 * which source paths, so that watch mode can invalidate the right entries
 * when a source asset changes.
 */
export interface AssetProcessingCache {
  get(key: string): Promise<CachedAssetProcessResult> | undefined
  set(key: string, value: Promise<CachedAssetProcessResult>): void
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
  blurOptions?: BlurOptions
}

/** Build a stable cache key for `processAsset` inputs. */
export const createAssetProcessKey = (input: AssetProcessKeyInput): string => {
  return JSON.stringify({
    sourcePath: input.sourcePath,
    filename: input.filename,
    baseUrl: input.baseUrl,
    suffix: input.suffix,
    isImage: input.isImage,
    blurOptions: input.blurOptions ?? null
  })
}

/** Create an in-memory asset processing cache. */
export const createAssetProcessingCache = (): AssetProcessingCache => {
  const entries = new Map<string, Promise<CachedAssetProcessResult>>()
  const sourceKeys = new Map<string, Set<string>>()
  const owners = new Map<string, Set<string>>()

  return {
    get(key) {
      return entries.get(key)
    },
    set(key, value) {
      entries.set(key, value)
      value.then(
        resolved => {
          if (entries.get(key) !== value) return
          let keys = sourceKeys.get(resolved.sourcePath)
          if (keys == null) {
            keys = new Set()
            sourceKeys.set(resolved.sourcePath, keys)
          }
          keys.add(key)
        },
        () => {
          if (entries.get(key) === value) entries.delete(key)
        }
      )
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
      return owners.has(sourcePath) || sourceKeys.has(sourcePath)
    },
    clear() {
      entries.clear()
      sourceKeys.clear()
      owners.clear()
    }
  }
}
