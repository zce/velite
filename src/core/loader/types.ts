import type { Diagnostic } from '../diagnostic'
import type { SourcePath } from '../model'

/** Input handed to a loader: a source's identity and decoded content. */
export interface LoaderInput {
  path: SourcePath
  bytes: Uint8Array
  text: string
}

/** One parsed item before schema validation. */
export interface LoadedItem {
  /** Stable key within the source (loader-provided, or array index fallback). */
  key: string | number
  data: unknown
  meta?: Record<string, unknown>
}

export interface LoaderResult {
  items: LoadedItem[]
  diagnostics?: Diagnostic[]
}

/**
 * Turns a source's content into one or more raw items. Pure and side-effect free:
 * no schema validation, no output writing, no filesystem access.
 */
export interface Loader {
  name: string
  /** Match by file extension (with dot, e.g. '.json') or a custom predicate. */
  match: string[] | ((path: SourcePath) => boolean)
  load(input: LoaderInput): LoaderResult
}
