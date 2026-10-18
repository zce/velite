import { diagnostic } from '../diagnostic'

import type { LoaderResult } from './types'

/** Wrap a parsed top-level value as a loader result. A top-level array yields one item per element (key = index). */
export const toItems = (parsed: unknown): LoaderResult =>
  Array.isArray(parsed) ? { items: parsed.map((data, index) => ({ key: index, data })) } : { items: [{ key: '', data: parsed }] }

/** Build the failure result for a loader that could not parse its input. */
export const loaderFailure = (label: string, path: string, cause: unknown): LoaderResult => ({
  items: [],
  diagnostics: [
    diagnostic('error', 'LOADER_FAILED', `invalid ${label}: ${cause instanceof Error ? cause.message : String(cause)}`, {
      stage: 'load',
      provenance: { scope: 'source', source: { path } },
      cause
    })
  ]
})
