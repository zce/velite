import { diagnostic } from '../diagnostic'

import type { Loader, LoaderResult } from './types'

/** Parses JSON. A top-level array yields one item per element (key = index). */
export const jsonLoader: Loader = {
  name: 'json',
  match: ['.json'],
  load({ path, text }): LoaderResult {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (cause) {
      return {
        items: [],
        diagnostics: [diagnostic('error', 'LOADER_FAILED', `invalid JSON: ${(cause as Error).message}`, { file: path, cause })]
      }
    }
    return toItems(parsed)
  }
}

export const toItems = (parsed: unknown): LoaderResult =>
  Array.isArray(parsed) ? { items: parsed.map((data, index) => ({ key: index, data })) } : { items: [{ key: '', data: parsed }] }
