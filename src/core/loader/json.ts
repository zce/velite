import { loaderFailure, toItems } from './result'

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
      return loaderFailure('JSON', path, cause)
    }
    return toItems(parsed)
  }
}
