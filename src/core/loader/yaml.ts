import { parse } from 'yaml'

import { loaderFailure, toItems } from './result'

import type { Loader, LoaderResult } from './types'

/** Parses YAML. A top-level sequence yields one item per element (key = index). */
export const yamlLoader: Loader = {
  name: 'yaml',
  match: ['.yaml', '.yml'],
  load({ path, text }): LoaderResult {
    let parsed: unknown
    try {
      parsed = parse(text)
    } catch (cause) {
      return loaderFailure('YAML', path, cause)
    }
    return toItems(parsed)
  }
}
