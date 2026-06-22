// Stable identity helpers for output file naming. Every function here is
// consumed only by `core/output/layout.ts`; none are part of the public API.
//
// Path operations use the pure posix path utility (no node:path); the identity
// hash delegates to the shared FNV-1a implementation in ./hash.

import { hash } from './hash'

const DEFAULT_RECORD_KEY = 'default'

/** Split a record id (`sourceId#key`) back into its parts. */
export const parseRecordId = (recordId: string): { sourceId: string; key: string } => {
  const index = recordId.lastIndexOf('#')
  if (index < 0) return { sourceId: recordId, key: DEFAULT_RECORD_KEY }
  return { sourceId: recordId.slice(0, index), key: recordId.slice(index + 1) }
}

/**
 * A short, content-independent hash of a record identity.
 *
 * Used for stable physical output file names in the dev split layout: the hash
 * is derived from identity, not content, so a record's path does not change
 * when only its content changes. Delegates to the shared FNV-1a digest.
 */
export const hashIdentity = (identity: string): string => hash(identity)

/** Sanitize a source/record stem for use in a human-readable file name segment. */
export const sanitizeStem = (input: string): string =>
  input
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'record'

/**
 * Pure-posix basename. The core's path util has no basename, but the layout
 * needs the final segment of a source id to name single-record files.
 */
export const basename = (input: string): string => {
  const i = input.lastIndexOf('/')
  return i < 0 ? input : input.slice(i + 1)
}
