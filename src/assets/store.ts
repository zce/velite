/** Asset record collected during a build session. */
export interface AssetRecord {
  /** Absolute source path of the original asset. */
  sourcePath: string
  /** Rendered output filename. Used as the dedup key. */
  outputName: string
  /** Final public URL exposed in parsed content. */
  publicUrl: string
  /** Content files that caused this asset to be collected. */
  ownerFiles: Set<string>
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
  add(input: { sourcePath: string; outputName: string; publicUrl: string; ownerFile: string; fingerprint?: string }): AssetRecord
  list(): AssetRecord[]
  byOwner(file: string): AssetRecord[]
}

interface InternalRecord extends AssetRecord {
  fingerprint?: string
}

/** Create a new asset store backed by an in-memory map. */
export const createAssetStore = (): AssetStore => {
  const records = new Map<string, InternalRecord>()

  return {
    add({ sourcePath, outputName, publicUrl, ownerFile, fingerprint }) {
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
        existing.ownerFiles.add(ownerFile)
        return existing
      }
      const record: InternalRecord = {
        sourcePath,
        outputName,
        publicUrl,
        ownerFiles: new Set([ownerFile]),
        fingerprint
      }
      records.set(outputName, record)
      return record
    },
    list() {
      return Array.from(records.values())
    },
    byOwner(file) {
      const out: AssetRecord[] = []
      for (const r of records.values()) {
        if (r.ownerFiles.has(file)) out.push(r)
      }
      return out
    }
  }
}

/** Store key used by asset-producing schemas. */
export const assetStoreKey = Symbol('velite.assets')
