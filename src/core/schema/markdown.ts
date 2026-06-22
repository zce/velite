import { z } from 'zod'

import { processMarkdown } from '../content/markdown'
import { context } from './context'

import type { PluggableList } from 'unified'
import type { MarkdownOptions } from '../content/markdown'
import type { Schema } from './s'

/** Options for the {@link markdown} schema. */
export interface MarkdownSchemaOptions {
  /** Enable GitHub Flavored Markdown. @default true */
  gfm?: boolean
  /** Remove html comments. @default true */
  removeComments?: boolean
  /** Remark plugins. */
  remarkPlugins?: PluggableList
  /** Rehype plugins. */
  rehypePlugins?: PluggableList
}

/** Render the current content body to HTML. */
export const markdown = (options: MarkdownSchemaOptions = {}): Schema<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, ctx) => {
      const { file, project } = context()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }
      const g = project.markdown
      const merged: MarkdownOptions = {
        gfm: options.gfm ?? g?.gfm ?? true,
        removeComments: options.removeComments ?? g?.removeComments ?? true,
        remarkPlugins: [...(options.remarkPlugins ?? []), ...(g?.remarkPlugins ?? [])],
        rehypePlugins: [...(options.rehypePlugins ?? []), ...(g?.rehypePlugins ?? [])]
      }
      try {
        const { html } = await processMarkdown(body, merged)
        return html
      } catch (err) {
        ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
