// Output reconciliation: write the planned data/type/entry files, skip
// unchanged writes, and delete stale outputs that are no longer part of the
// plan.
//
// Ported from the reconcile half of src/output/write.ts onto the new arch. The
// writer is the sole data-side side-effect boundary: it writes data/type/entry
// files (and record files in the split layout). Asset files are NOT handled
// here — the driver's two-pass asset flow copies asset files into the assets
// output directory separately (see src/core/driver.ts emitAndWrite). This split
// keeps the writer focused on the logical-output plan and avoids duplicating the
// asset-effect plumbing.

import { hash } from '../util/hash'
import { join, relative } from '../util/path'
import { recordFilePath } from './layout'
import { planSingleCollection, planSplitOutput, planWrites } from './plan'

import type { FileSystem } from '../../runtime/fs'
import type { CollectionMeta } from './declaration'
import type { LogicalOutput } from './logical'
import type { DataManifest } from './manifest'

const encoder = new TextEncoder()

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
  /** Incremental patch: only these collections have entries that changed. */
  changedCollections?: ReadonlySet<string>
  /**
   * Incremental patch (split layout): only entries originating from these
   * source paths changed. Other records have stable content-invariant paths
   * and stable data — the writer can skip them entirely.
   */
  changedSources?: ReadonlySet<string>
}

interface WriteResult {
  /** Output files written this run (unchanged files are skipped). */
  written: string[]
  manifest: DataManifest
}

const EMPTY_PREVIOUS: DataManifest = { files: {} }

/**
 * Reconcile logical output against the previous manifest: plan the physical
 * writes for the configured layout, write only changed files, and delete
 * outputs that no longer exist. Unchanged content (same path + digest) is
 * skipped.
 */
export const writeOutput = async (output: LogicalOutput, deps: WriteDeps, previous: DataManifest = EMPTY_PREVIOUS): Promise<WriteResult> => {
  const configRelPath = deps.configPath === '' ? 'velite.config.ts' : relative(deps.dir, deps.configPath)

  // Incremental single-layout patch: only the named collections' top-level
  // data files change. Re-stringify just those.
  if (deps.layout === 'single' && deps.changedCollections !== undefined) {
    const manifest: DataManifest = { files: { ...previous.files } }
    const written: string[] = []
    for (const collection of deps.collections) {
      if (!deps.changedCollections.has(collection.name)) continue
      const result = output.collections[collection.name]
      const entries = result?.entries ?? []
      const data = collection.single ? (entries[0]?.data ?? null) : entries.map(entry => entry.data)
      const write = planSingleCollection(collection.name, data, deps.pretty ?? true)
      const absPath = join(deps.dir, write.path)
      const digest = hash(write.content)
      manifest.files[absPath] = digest
      if (previous.files[absPath] === digest) continue
      await deps.fs.write(absPath, encoder.encode(write.content))
      written.push(absPath)
    }
    return { written, manifest }
  }

  // Incremental split-layout patch: only entries from `changedSources` need to
  // be re-stringified. Record file paths are derived from record identity, so
  // unchanged records keep stable paths and contents — the writer can copy
  // their manifest entries through. The collection/index/type modules depend
  // only on collection metadata, which the patch path doesn't touch.
  if (deps.layout === 'split' && deps.changedCollections !== undefined && deps.changedSources !== undefined) {
    const manifest: DataManifest = { files: { ...previous.files } }
    const written: string[] = []
    for (const collection of deps.collections) {
      if (!deps.changedCollections.has(collection.name)) continue
      const result = output.collections[collection.name]
      const entries = result?.entries ?? []
      const touchedEntries = entries.filter(entry => deps.changedSources!.has(entry.source))
      const writes = planSplitOutput(collection.name, touchedEntries, deps.pretty ?? true)
      for (const write of writes) {
        const absPath = join(deps.dir, write.path)
        const digest = hash(write.content)
        manifest.files[absPath] = digest
        if (previous.files[absPath] === digest) continue
        await deps.fs.write(absPath, encoder.encode(write.content))
        written.push(absPath)
      }
      // Reconcile any orphan record files that belong to the patched
      // collection but no longer correspond to any live entry id.
      const liveIds = new Set(entries.map(entry => join(deps.dir, recordFilePath(collection.name, entry.id))))
      const prefix = join(deps.dir, `records/${collection.name}/`)
      for (const file of Object.keys(previous.files)) {
        if (!file.startsWith(prefix)) continue
        if (liveIds.has(file)) continue
        await deps.fs.remove(file)
        delete manifest.files[file]
      }
    }
    return { written, manifest }
  }

  const writes = planWrites(
    {
      output,
      collections: deps.collections,
      format: deps.format,
      configRelPath,
      pretty: deps.pretty ?? true
    },
    deps.layout === 'split'
  )

  const manifest: DataManifest = { files: {} }
  const desired = new Set<string>()
  const written: string[] = []

  for (const write of writes) {
    const absPath = join(deps.dir, write.path)
    desired.add(absPath)
    const digest = hash(write.content)
    manifest.files[absPath] = digest
    if (previous.files[absPath] === digest) continue
    await deps.fs.write(absPath, encoder.encode(write.content))
    written.push(absPath)
  }

  for (const file of Object.keys(previous.files)) {
    if (!desired.has(file)) await deps.fs.remove(file)
  }

  return { written, manifest }
}
