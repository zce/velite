/** Asset record collected during a build session. */
export interface AssetRecord {
  /** Absolute source path of the original asset. */
  sourcePath: string
  /** Rendered output filename. Used as the dedup key. */
  outputName: string
}

/**
 * Session-owned store for asset collection.
 *
 * `add()` is idempotent for the same `outputName`. The same `outputName` with
 * a different `sourcePath` is accepted as long as the caller asserts the
 * content is identical (typically by passing a content `fingerprint`, e.g.
 * an md5 of the source bytes). When the caller provides fingerprints and they
 * disagree, `add()` throws to surface a real hash collision or an unsafe
 * filename template.
 */
export interface AssetStore {
  add(input: { sourcePath: string; outputName: string; fingerprint?: string }): AssetRecord
  list(): AssetRecord[]
}

interface InternalRecord extends AssetRecord {
  fingerprint?: string
}

/** Create a new asset store backed by an in-memory map. */
export const createAssetStore = (): AssetStore => {
  const records = new Map<string, InternalRecord>()

  return {
    add({ sourcePath, outputName, fingerprint }) {
      const existing = records.get(outputName)
      if (existing != null) {
        if (existing.sourcePath !== sourcePath) {
          // Different source path is fine when the caller proves the content
          // is identical (same md5 / same hash). Without a fingerprint, we
          // assume the template embeds enough entropy (typically `[hash]`).
          if (fingerprint != null && existing.fingerprint != null && fingerprint !== existing.fingerprint) {
            throw new Error(
              `Asset name collision for '${outputName}': '${existing.sourcePath}' and '${sourcePath}' have different content. ` +
                'Adjust the output filename template (for example include [hash:8]).'
            )
          }
          if (fingerprint != null && existing.fingerprint == null) {
            existing.fingerprint = fingerprint
          }
        }
        return existing
      }
      const record: InternalRecord = {
        sourcePath,
        outputName,
        fingerprint
      }
      records.set(outputName, record)
      return record
    },
    list() {
      return Array.from(records.values())
    }
  }
}

/** Store key used by asset-producing schemas. */
export const assetStoreKey = Symbol('velite.assets')
