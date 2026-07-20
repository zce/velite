import { z } from 'zod'

import { assetKeyOf } from '../pipeline/asset'
import { dirname, join, stripQueryAndHash } from '../util/path'
import { contentContext } from './content-context'
import { context } from './context'
import { buildExcerptSchema, buildMetadataSchema, buildTocSchema, selectText } from './projections'

import type { PluggableList } from 'unified'
import type { MarkdownOptions } from '../content/markdown'
import type { TocItem } from '../content/reference'
import type { ExcerptSchemaOptions } from './excerpt'
import type { Metadata } from './metadata'
import type { DialectProfile } from './projections'
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

/** A Markdown dialect root: the primary `string -> html` schema plus projections. */
export interface MarkdownRoot extends Schema<string> {
  /** Flat table-of-contents projection (independent schema, same dialect/profile). */
  toc(): Schema<TocItem[]>
  /** Plain-text excerpt projection (independent schema, same dialect/profile). */
  excerpt(options?: ExcerptSchemaOptions): Schema<string>
  /** Reading-time + word-count metadata projection (independent schema, same dialect/profile). */
  metadata(): Schema<Metadata>
}

/** Resolve the effective markdown profile for a record parse. */
const resolveMarkdownProfile = (options: MarkdownSchemaOptions): Pick<MarkdownOptions, 'gfm' | 'removeComments' | 'remarkPlugins' | 'rehypePlugins'> => {
  const g = context().project.markdown
  return {
    gfm: options.gfm ?? g?.gfm ?? true,
    removeComments: options.removeComments ?? g?.removeComments ?? true,
    remarkPlugins: [...(options.remarkPlugins ?? []), ...(g?.remarkPlugins ?? [])],
    rehypePlugins: [...(options.rehypePlugins ?? []), ...(g?.rehypePlugins ?? [])]
  }
}

/** Build the primary markdown schema (string -> html). */
const buildPrimarySchema = (options: MarkdownSchemaOptions): Schema<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, { addIssue }) => {
      const { file, project, record, asset, collectEffect } = context()
      const body = selectText(value, addIssue)
      if (body === null) return ''
      const profile = resolveMarkdownProfile(options)
      const copyLinkedFiles = options.copyLinkedFiles ?? project.markdown?.copyLinkedFiles ?? true
      const processAsset = copyLinkedFiles
        ? async (url: string): Promise<string> => {
            const absSourcePath = join(dirname(file.path), stripQueryAndHash(url))
            const assetKey = assetKeyOf(absSourcePath, project.root)
            const result = await asset(assetKey, { template: project.output.name })
            collectEffect({ type: 'asset', owner: record.id, assetPath: absSourcePath, publicUrl: result.publicUrl, resolved: result.resolved, isImage: false })
            return result.publicUrl
          }
        : undefined
      try {
        const capability = contentContext()
        const html = await capability.content({
          kind: 'render-markdown',
          text: body,
          path: file.path,
          dialect: 'markdown',
          profile,
          branchOptions: {
            gfm: profile.gfm ?? true,
            removeComments: profile.removeComments ?? true,
            remarkPlugins: profile.remarkPlugins ?? [],
            rehypePlugins: profile.rehypePlugins ?? [],
            processAsset
          }
        })
        return html as string
      } catch (err) {
        addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })

/** Render the current content body to HTML. */
export const markdown = (options: MarkdownSchemaOptions = {}): MarkdownRoot => {
  const primary = buildPrimarySchema(options) as MarkdownRoot
  const dp: DialectProfile = {
    dialect: 'markdown',
    // The projection profile MUST match the primary render profile so matching
    // demands coalesce to one pristine parse. The profile is resolved lazily
    // on each demand against the current project config.
    profile: () => resolveMarkdownProfile(options)
  }
  primary.toc = () => buildTocSchema(dp)
  primary.excerpt = (projectionOptions?: ExcerptSchemaOptions) => buildExcerptSchema(dp, projectionOptions)
  primary.metadata = () => buildMetadataSchema(dp)
  return primary
}
