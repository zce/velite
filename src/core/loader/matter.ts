import { parse } from 'yaml'

import { loaderFailure } from './result'

import type { Loader, LoaderResult } from './types'

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

/** Parses markdown/mdx with optional YAML frontmatter into one raw item. */
export const matterLoader: Loader = {
  name: 'matter',
  match: ['.md', '.mdx'],
  load({ path, text }): LoaderResult {
    const match = text.match(FRONTMATTER)
    if (match === null) {
      return { items: [{ key: '', data: { content: text } }] }
    }
    let meta: unknown
    try {
      meta = parse(match[1]!) ?? {}
    } catch (cause) {
      return loaderFailure('frontmatter', path, cause)
    }
    // Frontmatter must be a mapping. A scalar or sequence would otherwise be
    // spread into numeric-keyed objects downstream and surface as baffling
    // schema errors instead of a clean loader failure.
    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
      return loaderFailure('frontmatter', path, new Error('expected a YAML mapping of fields'))
    }
    const content = match[2]!
    return { items: [{ key: '', data: { ...meta, content } }] }
  }
}
