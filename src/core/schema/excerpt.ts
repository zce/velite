import { z } from 'zod'

import { extractText, parseMarkdown } from '../content/reference'
import { context } from './context'

import type { Schema } from './s'

/** Options for the {@link excerpt} schema. */
export interface ExcerptSchemaOptions {
  /** Excerpt length. @default 260 */
  length?: number
}

/**
 * Extract a plain-text excerpt from the current content.
 *
 * This is the transitional implementation: it parses the selected text directly
 * via `parseMarkdown` and uses `extractText`. Phase 2 (T2.4) replaces this with
 * the final code-point + `trimEnd()` + `U+2026` algorithm over dialect-correct
 * static visible text.
 */
export const excerpt = (options: ExcerptSchemaOptions = {}): Schema<string> => {
  const length = options.length ?? 260
  return z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, { addIssue }) => {
      const { file } = context()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }
      try {
        const tree = parseMarkdown(body)
        return extractText(tree, length)
      } catch (err) {
        addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
}
