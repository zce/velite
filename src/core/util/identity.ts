// Stable identity helpers for sources and records.
//
// Ported from src/core/ids.ts but runtime-agnostic: path operations use the
// pure posix path utility (no node:path), and the identity hash delegates to
// the shared FNV-1a implementation in ./hash. Identities are POSIX-style
// project-relative paths so they stay stable across operating systems and are
// safe to use as dependency-graph node ids, cache owners and output file stems.
//
// The new arch's EntryId (`${SourcePath}#${key}`) is the same shape as the old
// record id, so createRecordId/parseRecordId map onto it directly.

import { hash } from './hash'
import { posix } from './path'

const toPosix = (input: string): string => input.replaceAll('\\', '/')

/**
 * Create a stable source id from an absolute file path relative to `root`.
 *
 * @example
 * createSourceId('/repo/content/posts/hello.md', '/repo/content') // 'posts/hello.md'
 */
export const createSourceId = (absolutePath: string, root: string): string => toPosix(posix.relative(root, absolutePath))

/** A stable record key. Single-record sources use the literal `default`. */
export const DEFAULT_RECORD_KEY = 'default'

/**
 * Create a stable record id from a source id and a record key.
 *
 * When `key` is omitted the source produces a single record and the literal
 * `default` is used, keeping multi-record and single-record ids distinguishable.
 *
 * @example
 * createRecordId('authors.yml', 'zce') // 'authors.yml#zce'
 */
export const createRecordId = (sourceId: string, key?: string): string => {
  const recordKey = key == null || key === '' ? DEFAULT_RECORD_KEY : key
  return `${sourceId}#${recordKey}`
}

/** Split a record id back into its source id and record key. */
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
 * Pure-posix basename. The host {@link Path} interface has no basename, but the
 * layout needs the final segment of a source id to name single-record files.
 */
export const basename = (input: string): string => {
  const i = input.lastIndexOf('/')
  return i < 0 ? input : input.slice(i + 1)
}
