import { z } from 'zod'

import { extractToc } from '../content/reference'
import { context } from './context'

import type { TocItem } from '../content/reference'
import type { Schema } from './s'

/** Extract a flat table of contents (headings) from the current content. */
export const toc = (): Schema<TocItem[]> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<TocItem[]>(async (value, ctx) => {
      const { file } = context()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return []
      }
      try {
        // Use the lazily-cached mdast from the schema context rather than
        // re-parsing. The context computes `file.mdast` once via
        // `fromMarkdown()` and caches it, so every builtin that needs the
        // AST in the same record parse shares one parse call.
        const tree = file.mdast
        if (tree == null) throw new Error('No mdast tree available')
        return extractToc(tree)
      } catch (err) {
        ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
