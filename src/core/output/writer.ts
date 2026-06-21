import { hash } from '../util/hash'
import { emptyManifest } from './manifest'

import type { FileSystem } from '../host/fs'
import type { Path } from '../host/path'
import type { LogicalOutput } from './logical'
import type { OutputManifest } from './manifest'

const encoder = new TextEncoder()

/** Reduce a collection result to its plain data payload. */
const payloadOf = (output: LogicalOutput): Record<string, unknown> => {
  const data: Record<string, unknown> = {}
  for (const [name, result] of Object.entries(output.collections)) {
    data[name] = result.mode === 'single' ? (result.entries[0]?.data ?? null) : result.entries.map(entry => entry.data)
  }
  return data
}

export interface WriteResult {
  /** Output files written this run (unchanged files are skipped). */
  written: string[]
  manifest: OutputManifest
}

/**
 * Reconcile logical output against the previous manifest: write only changed
 * files, delete outputs that no longer exist. Unchanged content is skipped.
 */
export const writeOutput = async (
  output: LogicalOutput,
  deps: { fs: FileSystem; path: Path; dir: string },
  previous: OutputManifest = emptyManifest()
): Promise<WriteResult> => {
  const payload = payloadOf(output)
  const manifest: OutputManifest = { files: {} }
  const desired = new Set<string>()
  const written: string[] = []

  for (const [name, data] of Object.entries(payload)) {
    const file = deps.path.join(deps.dir, `${name}.json`)
    desired.add(file)
    const bytes = encoder.encode(JSON.stringify(data, null, 2))
    const digest = hash(bytes)
    manifest.files[file] = digest
    if (previous.files[file] === digest) continue
    await deps.fs.write(file, bytes)
    written.push(file)
  }

  for (const file of Object.keys(previous.files)) {
    if (!desired.has(file)) await deps.fs.remove(file)
  }

  return { written, manifest }
}
