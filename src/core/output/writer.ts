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
import { emptyManifest } from './manifest'
import { planWrites } from './plan'

import type { FileSystem } from '../../runtime/fs'
import type { CollectionMeta } from './declaration'
import type { LogicalOutput } from './logical'
import type { OutputManifest } from './manifest'

const encoder = new TextEncoder()

export interface WriteDeps {
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
}

export interface WriteResult {
  /** Output files written this run (unchanged files are skipped). */
  written: string[]
  manifest: OutputManifest
}

/**
 * Reconcile logical output against the previous manifest: plan the physical
 * writes for the configured layout, write only changed files, and delete
 * outputs that no longer exist. Unchanged content (same path + digest) is
 * skipped.
 */
export const writeOutput = async (output: LogicalOutput, deps: WriteDeps, previous: OutputManifest = emptyManifest()): Promise<WriteResult> => {
  const configRelPath = deps.configPath === '' ? 'velite.config.ts' : relative(deps.dir, deps.configPath)
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

  const manifest: OutputManifest = { files: {} }
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
