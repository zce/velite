import { parse } from 'yaml'

import { diagnostic } from '../diagnostic'
import { toItems } from './json'

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
      return {
        items: [],
        diagnostics: [diagnostic('error', 'LOADER_FAILED', `invalid YAML: ${(cause as Error).message}`, { file: path, cause })]
      }
    }
    return toItems(parsed)
  }
}
