import { z } from 'zod'

import { processMarkdown } from '../content/markdown'
import { assetKeyOf } from '../pipeline/asset'
import { dirname, join, stripQueryAndHash } from '../util/path'
import { context } from './context'

import type { PluggableList } from 'unified'
import type { MarkdownOptions, MarkdownSource } from '../content/markdown'
import type { Schema } from './s'

/** Options for the {@link markdown} schema. */
export interface MarkdownSchemaOptions {
  /** Enable GitHub Flavored Markdown. @default true */
  gfm?: boolean
  /** Remove html comments. @default true */
  removeComments?: boolean
  /**
   * Copy locally-referenced asset files (relative `href` / `src` / `poster`)
   * into the assets output and rewrite their urls to the content-hashed public
   * urls. @default true
   */
  copyLinkedFiles?: boolean
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
    .transform<string>(async (value, { addIssue }) => {
      const { file, project, record, asset, collectEffect } = context()
      const body = value ?? file.content
      if (body == null || body.length === 0) {
        addIssue({ code: 'custom', message: 'The content is empty' })
        return ''
      }
      // SSOT: when the schema is parsing the file's own body, reuse the
      // lazily-parsed `file.mdast` so processMarkdown / toc / excerpt /
      // references share a single parse. An explicit `value` overrides the
      // body and is parsed fresh.
      const source: MarkdownSource = value === undefined && file.mdast !== undefined ? file.mdast : body
      const g = project.markdown
      const copyLinkedFiles = options.copyLinkedFiles ?? g?.copyLinkedFiles ?? true
      const merged: MarkdownOptions = {
        gfm: options.gfm ?? g?.gfm ?? true,
        removeComments: options.removeComments ?? g?.removeComments ?? true,
        remarkPlugins: [...(options.remarkPlugins ?? []), ...(g?.remarkPlugins ?? [])],
        rehypePlugins: [...(options.rehypePlugins ?? []), ...(g?.rehypePlugins ?? [])]
      }
      if (copyLinkedFiles) {
        merged.processAsset = async (url: string): Promise<string> => {
          const absSourcePath = join(dirname(file.path), stripQueryAndHash(url))
          const assetKey = assetKeyOf(absSourcePath, project.root)
          const result = await asset(assetKey, { template: project.output.name })
          collectEffect({ type: 'asset', owner: record.id, assetPath: absSourcePath, publicUrl: result.publicUrl, resolved: result.resolved, isImage: false })
          return result.publicUrl
        }
      }
      try {
        const { html } = await processMarkdown(source, merged)
        return html
      } catch (err) {
        addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
