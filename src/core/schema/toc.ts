import { z } from 'zod'

import { extractToc, parseMarkdown } from '../content/reference'
import { context } from './context'

import type { TocItem } from '../content/reference'
import type { Schema } from './s'

/**
 * Extract a flat table of contents (headings) from the current content.
 *
 * This is the transitional implementation: it parses the selected text directly
 * via `parseMarkdown`. Phase 2 (T2.3) replaces this with the record-scoped
 * content derivation module that coalesces matching pristine parses across the
 * primary root and all sibling projections.
 */
export const toc = (): Schema<TocItem[]> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<TocItem[]>(async (value, { addIssue }) => {
      const { file } = context()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        addIssue({ code: 'custom', message: 'The content is empty' })
        return []
      }
      try {
        const tree = parseMarkdown(body)
        return extractToc(tree)
      } catch (err) {
        addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
