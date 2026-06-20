import { relative, sep } from 'node:path'

/**
 * Stable identity helpers for sources and records.
 *
 * Identities are POSIX-style project-relative paths so they stay stable across
 * operating systems and are safe to use as dependency-graph node ids, cache
 * owners and output file stems.
 */

const toPosix = (input: string): string => input.replaceAll('\\', '/')

/**
 * Create a stable source id from an absolute file path relative to `root`.
 *
 * @example
 * createSourceId('/repo/content/posts/hello.md', '/repo/content') // 'posts/hello.md'
 */
export const createSourceId = (absolutePath: string, root: string): string => {
  const rel = relative(root, absolutePath)
  return toPosix(rel.split(sep).join('/'))
}

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
 * when only its content changes.
 */
export const hashIdentity = (identity: string): string => {
  // FNV-1a 32-bit. Fast, dependency-free, good enough for file-name disambiguation.
  let hash = 0x811c9dc5
  for (let i = 0; i < identity.length; i++) {
    hash ^= identity.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Sanitize a source/record stem for use in a human-readable file name segment. */
export const sanitizeStem = (input: string): string =>
  input
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'record'
