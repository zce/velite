import { parse } from 'yaml'

import { diagnostic } from '../diagnostic'

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
    let meta: Record<string, unknown>
    try {
      meta = (parse(match[1]!) as Record<string, unknown>) ?? {}
    } catch (cause) {
      return {
        items: [],
        diagnostics: [
          diagnostic('error', 'LOADER_FAILED', `invalid frontmatter: ${(cause as Error).message}`, {
            file: path,
            cause
          })
        ]
      }
    }
    const content = match[2] ?? ''
    return { items: [{ key: '', data: { ...meta, content } }] }
  }
}
