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
      const g = project.markdown
      const userRemarkPlugins = [...(options.remarkPlugins ?? []), ...(g?.remarkPlugins ?? [])]
      const merged: MarkdownOptions = {
        gfm: options.gfm ?? g?.gfm ?? true,
        removeComments: options.removeComments ?? g?.removeComments ?? true,
        remarkPlugins: userRemarkPlugins,
        rehypePlugins: [...(options.rehypePlugins ?? []), ...(g?.rehypePlugins ?? [])]
      }
      const copyLinkedFiles = options.copyLinkedFiles ?? g?.copyLinkedFiles ?? true
      if (copyLinkedFiles) {
        merged.processAsset = async (url: string): Promise<string> => {
          const absSourcePath = join(dirname(file.path), stripQueryAndHash(url))
          const assetKey = assetKeyOf(absSourcePath, project.root)
          const result = await asset(assetKey, { template: project.output.name })
          collectEffect({ type: 'asset', owner: record.id, assetPath: absSourcePath, publicUrl: result.publicUrl, resolved: result.resolved, isImage: false })
          return result.publicUrl
        }
      }
      // SSOT: reuse the lazily-cached file.mdast when:
      // 1. No explicit field value (value === undefined)
      // 2. GFM is enabled (file.mdast is GFM-parsed; gfm: false needs fresh parse)
      // 3. No custom plugins (custom plugins transform the mdast differently
      //    than the shared base parse, so we must re-parse from source)
      const hasCustomPlugins = userRemarkPlugins.length > 0 || merged.rehypePlugins!.length > 0 || merged.processAsset != null
      const useCache = value === undefined && (merged.gfm ?? true) && !hasCustomPlugins && file.mdast !== undefined
      const source: MarkdownSource = useCache ? file.mdast! : body
      try {
        return await processMarkdown(source, merged)
      } catch (err) {
        addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
