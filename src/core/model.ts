// Shared domain vocabulary. Kept intentionally thin: only cross-layer types with
// no single owning module belong here. Everything else lives next to its owner.
//
// NOTE: the validated data item is named `Entry` (not `Record`) to avoid shadowing
// TypeScript's built-in `Record<K, V>` utility type across the codebase. The PRD
// concept "record" maps to this `Entry` type.

/** Posix path relative to the project root. */
export type SourcePath = string

/** Stable identity of an entry: its source plus a loader-provided key (or index). */
export type EntryId = `${SourcePath}#${string}`

/** A collection name, which is also the output data key. */
export type Collection = string

/** A located input file belonging to a collection. */
export interface Source {
  path: SourcePath
  absPath: string
  collection: Collection
  stat: { mtimeMs: number; size: number }
}

/** A raw, not-yet-validated entry produced by a loader. */
export interface RawEntry {
  id: EntryId
  source: SourcePath
  key: string | number
  data: unknown
  meta?: Record<string, unknown>
}

/** A validated, transformed entry. */
export interface Entry<T = unknown> {
  id: EntryId
  source: SourcePath
  data: T
}

/** The result of one collection: ordered validated entries. */
export interface CollectionResult<T = unknown> {
  collection: Collection
  mode: 'list' | 'single'
  entries: Entry<T>[]
}
