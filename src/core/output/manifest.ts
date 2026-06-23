import { normalize } from '../util/path'

import type { FileSystem } from '../../runtime/fs'

/**
 * Velite-owned bookkeeping of the previous successful build. Persisted to disk
 * (`output.data/.manifest.json`) so that one-shot `build()` invocations across
 * processes can still reconcile stale data files and orphan asset copies —
 * without ever touching files Velite did not write itself.
 *
 * `files` carries the data-side reconciliation map (the writer reads/writes
 * it); `assets` carries the asset-side reconciliation set (the driver reads/
 * writes it). The two halves are tracked together so a single on-disk record
 * captures everything Velite wrote in the previous run.
 */
export interface OutputManifest {
  /** Absolute output file paths (data side) → content digest. */
  files: Record<string, string>
  /** Absolute asset dest paths Velite copied into the assets output dir. */
  assets: string[]
}

/** Data-side slice consumed by the writer. */
export interface DataManifest {
  files: Record<string, string>
}

export const emptyManifest = (): OutputManifest => ({ files: {}, assets: [] })

/** On-disk manifest filename. Lives under the configured data directory. */
export const MANIFEST_FILENAME = '.manifest.json'

const decoder = new TextDecoder()
const encoder = new TextEncoder()

/**
 * Return the normalized path if it lies strictly under `root`, else `null`.
 *
 * Both inputs are normalized first so `..` segments cannot escape the prefix
 * check: a value like `/proj/.velite/../outside.txt` normalizes to
 * `/proj/outside.txt` and is rejected against the data root `/proj/.velite`.
 * The normalized root and entry are also compared as path segments
 * (`root + '/'`), not as raw substrings, so a sibling directory whose name
 * happens to start with the root (`/proj/.velite-backup/...`) is rejected.
 */
const withinRoot = (entry: string, root: string): string | null => {
  if (typeof entry !== 'string' || entry.length === 0) return null
  const normalizedEntry = normalize(entry)
  const normalizedRoot = normalize(root)
  if (normalizedEntry === normalizedRoot) return null
  const prefix = normalizedRoot.endsWith('/') ? normalizedRoot : normalizedRoot + '/'
  return normalizedEntry.startsWith(prefix) ? normalizedEntry : null
}

/**
 * Best-effort manifest load. A missing/corrupt file is treated as "no previous
 * build" — the caller starts from an empty manifest and reconciliation becomes
 * a no-op for that run. Never throws.
 *
 * Entries are normalized and validated against the given `dataRoot` /
 * `assetsRoot` before being returned: only paths whose normalized value lies
 * strictly under the configured output directory are kept. A corrupted or
 * edited `.manifest.json` cannot make the next build delete files outside
 * Velite's own output — `..` traversal in entries is collapsed before the
 * containment check, so `/proj/.velite/../outside.txt` is rejected.
 */
export const loadManifest = async (fs: FileSystem, absPath: string, dataRoot: string, assetsRoot: string): Promise<OutputManifest> => {
  try {
    const bytes = await fs.read(absPath)
    const parsed = JSON.parse(decoder.decode(bytes)) as Partial<OutputManifest>
    const files: Record<string, string> = {}
    if (parsed.files != null && typeof parsed.files === 'object') {
      for (const [k, v] of Object.entries(parsed.files)) {
        if (typeof v !== 'string') continue
        const safe = withinRoot(k, dataRoot)
        if (safe !== null) files[safe] = v
      }
    }
    const assets: string[] = []
    if (Array.isArray(parsed.assets)) {
      for (const entry of parsed.assets) {
        const safe = withinRoot(entry as string, assetsRoot)
        if (safe !== null) assets.push(safe)
      }
    }
    return { files, assets }
  } catch {
    return emptyManifest()
  }
}

/** Persist the manifest. Failures are silent — the next build re-reconciles on its own data. */
export const saveManifest = async (fs: FileSystem, absPath: string, manifest: OutputManifest): Promise<void> => {
  try {
    await fs.write(absPath, encoder.encode(JSON.stringify(manifest)))
  } catch {
    // best-effort persistence; the next build will still reconcile from the
    // in-memory manifest, just without cross-process awareness.
  }
}
