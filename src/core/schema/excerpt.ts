import { z } from 'zod'

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
 * Uses the lazily-cached `file.plain` from the schema context rather than
 * re-parsing the markdown body. The context computes `file.plain` once (via
 * mdast → hast → plain text) and caches it, so every builtin that needs
 * plain text in the same record parse shares the computation.
 */
export const excerpt = ({ length = 260 }: ExcerptSchemaOptions = {}): Schema<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, { addIssue }) => {
      const { file } = context()
      const body = value ?? file.plain
      if (body == null || body.length === 0) {
        addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }
      return body.slice(0, length)
    })
