import { z } from 'zod'

import { extractText, parseMarkdown } from '../content/reference'
import { context } from './context'

import type { Schema } from './s'

/** Options for the {@link excerpt} schema. */
export interface ExcerptSchemaOptions {
  /** Excerpt length. @default 260 */
  length?: number
}

/** Extract a plain-text excerpt from the current content. */
export const excerpt = ({ length = 260 }: ExcerptSchemaOptions = {}): Schema<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, ctx) => {
      const { file } = context()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }
      try {
        return extractText(parseMarkdown(body), length)
      } catch (err) {
        ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
