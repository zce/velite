import type { Diagnostic } from '../diagnostic'
import type { CollectionResult, Entry, RawEntry } from '../model'
import type { LogicalOutput } from '../output/logical'

export interface Loaded {
  entries: RawEntry[]
  diagnostics: Diagnostic[]
}

export interface Validated {
  entries: Entry[]
  diagnostics: Diagnostic[]
}

export interface Collected {
  result: CollectionResult
  diagnostics: Diagnostic[]
}

export interface Emitted {
  output: LogicalOutput
  diagnostics: Diagnostic[]
}

/** Key for the per-source validate derivation. */
export interface ValidateKey {
  collection: string
  path: string
}
