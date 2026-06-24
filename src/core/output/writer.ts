// Output reconciliation: write the planned data/type/entry files, skip
// unchanged writes, and delete stale outputs that are no longer part of the
// plan.
//
// The writer is the sole data-side side-effect boundary: it writes
// data/type/entry files (and record files in the split layout). Asset files
// are NOT handled here — the driver's two-pass asset flow copies asset files
// into the assets output directory separately (see src/core/driver.ts
// emitAndWrite). This split keeps the writer focused on the logical-output
// plan and avoids duplicating the asset-effect plumbing.

import { hash } from '../util/hash'
import { join, relative } from '../util/path'
import { collectionDataPath, recordFilePath } from './layout'
import { planSplitOutput, planWrites } from './plan'

import type { FileSystem } from '../../runtime/fs'
import type { CollectionMeta } from './declaration'
import type { LogicalOutput } from './logical'
import type { DataManifest } from './manifest'
import type { OutputWrite } from './plan'

const encoder = new TextEncoder()

/**
 * Per-entry JSON string cache for single layout. After a full build, each
 * entry's `JSON.stringify(data)` is cached so that incremental builds only
 * need to re-stringify the entries that actually changed.
 */
export interface EntryJsonCache {
  /** Per-entry JSON strings, keyed by collection name. */
  jsons: Map<string, string[]>
  /** Per-entry content digests, keyed by collection name. */
  digests: Map<string, string[]>
}

interface WriteDeps {
  fs: FileSystem
  /** Absolute data output directory. */
  dir: string
  /** Physical layout: `split` (dev, per-record files) or `single` (prod). */
  layout: 'split' | 'single'
  /** Absolute path to the user config file (for the generated `index.d.ts`). */
  configPath: string
  /** Collection metadata (name/typeName/single) for the entry module + types. */
  collections: readonly CollectionMeta[]
  /** Entry module format. */
  format: 'esm' | 'cjs'
  /** Pretty-print JSON data files (dev). @default true */
  pretty?: boolean
  /**
   * Incremental patch: only these collections changed. Triggers the fast
   * path; `split` layout additionally requires {@link WriteDeps.changedSources}.
   */
  changedCollections?: ReadonlySet<string>
  /**
   * Incremental patch (split layout): only entries originating from these
   * source paths changed. Other records have content-invariant paths and
   * stable data, so the writer skips them entirely.
   */
  changedSources?: ReadonlySet<string>
  /**
   * Entry JSON string cache for incremental single layout. When available,
   * the writer only re-stringifies entries from changed sources and
   * concatenates with cached strings for unchanged entries.
   */
  entryJsonCache?: EntryJsonCache
}

interface WriteResult {
  /** Output files written this run (unchanged files are skipped). */
  written: string[]
  manifest: DataManifest
  /** Updated entry JSON cache (populated on full builds, updated on patches). */
  entryJsonCache: EntryJsonCache
}

const EMPTY_PREVIOUS: DataManifest = { files: {} }

const stringify = (data: unknown, pretty: boolean): string => JSON.stringify(data, null, pretty ? 2 : undefined)

/**
 * Commit a planned write: hash, skip if unchanged in `previous`, otherwise
 * write to disk and stamp the digest in `manifest`. Returns the abs path on
 * write, `undefined` on skip.
 */
const commitWrite = async (write: OutputWrite, dir: string, previous: DataManifest, manifest: DataManifest, fs: FileSystem): Promise<string | undefined> => {
  const absPath = join(dir, write.path)
  const digest = hash(write.content)
  manifest.files[absPath] = digest
  if (previous.files[absPath] === digest) return undefined
  await fs.write(absPath, encoder.encode(write.content))
  return absPath
}

/**
 * Build single-layout collection JSON for a list collection. Uses the entry
 * JSON cache when available: only entries from `changedSources` are
 * re-stringified; the rest are reused from the previous build.
 *
 * Returns the JSON string and updates the entry cache (jsons + digests).
 */
const buildListCollectionJson = (
  entries: ReadonlyArray<{ source: string; data: unknown }>,
  pretty: boolean,
  collectionName: string,
  changedSources: ReadonlySet<string> | undefined,
  cache: EntryJsonCache
): string => {
  const cachedJsons = cache.jsons.get(collectionName)
  const cachedDigests = cache.digests.get(collectionName)
  const parts: string[] = []
  const digests: string[] = []

  if (cachedJsons !== undefined && cachedDigests !== undefined && cachedJsons.length === entries.length && changedSources !== undefined) {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!
      if (changedSources.has(entry.source)) {
        const json = stringify(entry.data, pretty)
        parts.push(json)
        digests.push(hash(json))
      } else {
        parts.push(cachedJsons[i]!)
        digests.push(cachedDigests[i]!)
      }
    }
  } else {
    for (const entry of entries) {
      const json = stringify(entry.data, pretty)
      parts.push(json)
      digests.push(hash(json))
    }
  }

  cache.jsons.set(collectionName, parts)
  cache.digests.set(collectionName, digests)
  return '[' + parts.join(',') + ']'
}

/**
 * Compute a collection-level digest from per-entry digests. Much faster than
 * hashing the full JSON string (microseconds vs milliseconds for 10k entries).
 */
const collectionDigest = (entryDigests: string[]): string => hash(entryDigests.join('\0'))

/**
 * Reconcile logical output against the previous manifest: plan the physical
 * writes for the configured layout, write only changed files, and delete
 * outputs that no longer exist. Unchanged content (same path + digest) is
 * skipped.
 */
export const writeOutput = async (output: LogicalOutput, deps: WriteDeps, previous: DataManifest = EMPTY_PREVIOUS): Promise<WriteResult> => {
  const pretty = deps.pretty ?? true
  const entryJsonCache: EntryJsonCache = {
    jsons: new Map(deps.entryJsonCache?.jsons),
    digests: new Map(deps.entryJsonCache?.digests)
  }

  // Incremental single-layout patch: only the named collections' top-level
  // data files change. Uses entry JSON cache to avoid re-stringifying
  // unchanged entries and entry-level digests to avoid re-hashing the full
  // collection JSON.
  if (deps.layout === 'single' && deps.changedCollections !== undefined) {
    const manifest: DataManifest = { files: { ...previous.files } }
    const written: string[] = []
    for (const collection of deps.collections) {
      if (!deps.changedCollections.has(collection.name)) continue
      const entries = output.collections[collection.name]?.entries ?? []
      let content: string
      let digest: string
      if (collection.single) {
        content = stringify(entries[0]?.data ?? null, pretty)
        digest = hash(content)
      } else {
        content = buildListCollectionJson(entries, pretty, collection.name, deps.changedSources, entryJsonCache)
        digest = collectionDigest(entryJsonCache.digests.get(collection.name) ?? [])
      }
      const absPath = join(deps.dir, collectionDataPath(collection.name))
      manifest.files[absPath] = digest
      if (previous.files[absPath] === digest) continue
      await deps.fs.write(absPath, encoder.encode(content))
      written.push(absPath)
    }
    return { written, manifest, entryJsonCache }
  }

  // Incremental split-layout patch: only entries from `changedSources` need
  // to be re-stringified. Record paths are derived from record identity, so
  // unchanged records keep stable paths and contents — the writer copies
  // their manifest entries through. Collection/index/type modules depend only
  // on collection metadata, which the patch path doesn't touch.
  if (deps.layout === 'split' && deps.changedCollections !== undefined && deps.changedSources !== undefined) {
    const manifest: DataManifest = { files: { ...previous.files } }
    const written: string[] = []
    for (const collection of deps.collections) {
      if (!deps.changedCollections.has(collection.name)) continue
      const entries = output.collections[collection.name]?.entries ?? []
      const touched = entries.filter(e => deps.changedSources!.has(e.source))
      for (const write of planSplitOutput(collection.name, touched, pretty)) {
        const absPath = await commitWrite(write, deps.dir, previous, manifest, deps.fs)
        if (absPath !== undefined) written.push(absPath)
      }
      // Reconcile any orphan record files that belong to the patched
      // collection but no longer correspond to any live entry id.
      const liveIds = new Set(entries.map(e => join(deps.dir, recordFilePath(collection.name, e.id))))
      const prefix = join(deps.dir, `records/${collection.name}/`)
      for (const file of Object.keys(previous.files)) {
        if (!file.startsWith(prefix) || liveIds.has(file)) continue
        await deps.fs.remove(file)
        delete manifest.files[file]
      }
    }
    return { written, manifest, entryJsonCache }
  }

  // Full reconciliation: plan everything, write changes, delete stale.
  const configRelPath = deps.configPath === '' ? 'velite.config.ts' : relative(deps.dir, deps.configPath)
  const writes = planWrites({ output, collections: deps.collections, format: deps.format, configRelPath, pretty }, deps.layout === 'split')

  const manifest: DataManifest = { files: {} }
  const desired = new Set<string>()
  const written: string[] = []
  for (const write of writes) {
    desired.add(join(deps.dir, write.path))
    const absPath = await commitWrite(write, deps.dir, previous, manifest, deps.fs)
    if (absPath !== undefined) written.push(absPath)
  }
  for (const file of Object.keys(previous.files)) {
    if (!desired.has(file)) await deps.fs.remove(file)
  }

  // Populate entry JSON cache for single layout (for future incremental builds).
  if (deps.layout === 'single') {
    for (const collection of deps.collections) {
      if (collection.single) continue
      const entries = output.collections[collection.name]?.entries ?? []
      const jsons: string[] = []
      const digests: string[] = []
      for (const entry of entries) {
        const json = stringify(entry.data, pretty)
        jsons.push(json)
        digests.push(hash(json))
      }
      entryJsonCache.jsons.set(collection.name, jsons)
      entryJsonCache.digests.set(collection.name, digests)
    }
  }

  return { written, manifest, entryJsonCache }
}
