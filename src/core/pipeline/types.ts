import type { Diagnostic } from '../diagnostic'
import type { CollectionResult, Entry, RawEntry } from '../model'
import type { LogicalOutput } from '../output/logical'
import type { Effect } from '../schema/effects'

export interface Loaded {
  entries: RawEntry[]
  diagnostics: Diagnostic[]
}

export interface Validated {
  entries: Entry[]
  /** Schema effects collected from this source's records (asset refs, unique, ...). */
  effects: Effect[]
  diagnostics: Diagnostic[]
}

export interface Collected {
  result: CollectionResult
  /** Effects aggregated across all sources of this collection. */
  effects: Effect[]
  diagnostics: Diagnostic[]
}

export interface Emitted {
  output: LogicalOutput
  /** Effects aggregated across all collections — the driver consumes asset refs. */
  effects: Effect[]
  diagnostics: Diagnostic[]
}

/** Key for the per-source validate derivation. */
export interface ValidateKey {
  collection: string
  path: string
}
