import { z } from 'zod'

import { extractToc, parseMarkdown } from '../content/reference'
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
        return extractToc(parseMarkdown(body))
      } catch (err) {
        ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
