import { fail } from '../core/errors'

/** Asset record collected during a build session. */
export interface AssetRecord {
  /** Absolute source path of the original asset. */
  sourcePath: string
  /** Rendered output filename. Used as the dedup key. */
  outputName: string
  /** Content fingerprint (md5 of source bytes) when known. */
  fingerprint?: string
}

/**
 * Session-owned store for asset collection.
 *
 * `add()` is idempotent for the same `outputName`. The same `outputName` with a
 * different `sourcePath` is accepted when the caller proves the content is
 * identical (same fingerprint); otherwise it throws to surface a real name
 * collision that the user should fix via the filename template.
 */
export interface AssetStore {
  add(input: { sourcePath: string; outputName: string; fingerprint?: string }): AssetRecord
  list(): AssetRecord[]
  clear(): void
}

/** Create a new asset store backed by an in-memory map. */
export const createAssetStore = (): AssetStore => {
  const records = new Map<string, AssetRecord>()

  return {
    add({ sourcePath, outputName, fingerprint }) {
      const existing = records.get(outputName)
      if (existing != null) {
        if (existing.sourcePath !== sourcePath) {
          if (fingerprint != null && existing.fingerprint != null && fingerprint !== existing.fingerprint) {
            fail('asset', {
              message:
                `Asset name collision for '${outputName}': '${existing.sourcePath}' and '${sourcePath}' have different content. ` +
                'Adjust the output filename template (for example include [hash:8]).',
              context: { outputName, existingSourcePath: existing.sourcePath, sourcePath }
            })
          }
          if (fingerprint != null && existing.fingerprint == null) existing.fingerprint = fingerprint
        }
        return existing
      }
      const record: AssetRecord = { sourcePath, outputName, fingerprint }
      records.set(outputName, record)
      return record
    },
    list() {
      return Array.from(records.values())
    },
    clear() {
      records.clear()
    }
  }
}
