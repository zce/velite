import { z } from 'zod'

import { processMdx } from '../content/mdx'
import { assetKeyOf } from '../pipeline/asset'
import { dirname, join, stripQueryAndHash } from '../util/path'
import { context } from './context'
import { buildExcerptSchema, buildMetadataSchema, buildTocSchema, selectText } from './projections'

import type { PluggableList } from 'unified'
import type { ProcessMdxOptions } from '../content/mdx'
import type { TocItem } from '../content/reference'
import type { ExcerptSchemaOptions } from './excerpt'
import type { Metadata } from './metadata'
import type { DialectProfile } from './projections'
import type { Schema } from './s'

/** Options for the {@link mdx} schema. */
export interface MdxSchemaOptions {
  /** Enable GitHub Flavored Markdown. @default true */
  gfm?: boolean
  /** Remove `/* ... *​/` comments from mdx expressions. @default true */
  removeComments?: boolean
  /** Minify the output code via terser. @default true */
  minify?: boolean
  /** Output format to generate. @default 'function-body' */
  outputFormat?: 'program' | 'function-body'
  /** Remark plugins. */
  remarkPlugins?: PluggableList
  /** Rehype plugins. */
  rehypePlugins?: PluggableList
  /** Enable development-friendly output. @default false */
  development?: boolean
  /**
   * Copy locally-referenced asset files (relative `url`s on `link` / `image` /
   * `definition` nodes and on mdx JSX attributes) into the assets output and
   * rewrite to the content-hashed public urls. @default true
   */
  copyLinkedFiles?: boolean
}

/** An MDX dialect root: the primary `string -> function-body` schema plus projections. */
export interface MdxRoot extends Schema<string> {
  /** Flat table-of-contents projection (independent schema, same dialect/profile). */
  toc(): Schema<TocItem[]>
  /** Plain-text excerpt projection (independent schema, same dialect/profile). */
  excerpt(options?: ExcerptSchemaOptions): Schema<string>
  /** Reading-time + word-count metadata projection (independent schema, same dialect/profile). */
  metadata(): Schema<Metadata>
}

/** Build the primary mdx schema (string -> function-body). */
const buildPrimarySchema = (options: MdxSchemaOptions): Schema<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async (value, { addIssue }) => {
      const { file, project, record, asset, collectEffect } = context()
      const body = selectText(value, addIssue)
      if (body === null) return ''
      const g = project.mdx
      const copyLinkedFiles = options.copyLinkedFiles ?? g?.copyLinkedFiles ?? true
      const merged: ProcessMdxOptions = {
        gfm: options.gfm ?? g?.gfm ?? true,
        removeComments: options.removeComments ?? g?.removeComments ?? true,
        minify: options.minify ?? g?.minify ?? true,
        outputFormat: options.outputFormat ?? g?.outputFormat ?? 'function-body',
        development: options.development ?? g?.development ?? false,
        remarkPlugins: [...(options.remarkPlugins ?? []), ...(g?.remarkPlugins ?? [])],
        rehypePlugins: [...(options.rehypePlugins ?? []), ...(g?.rehypePlugins ?? [])],
        path: file.path
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
        return await processMdx(body, merged)
      } catch (err) {
        addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })

/** Compile the current content body as MDX. */
export const mdx = (options: MdxSchemaOptions = {}): MdxRoot => {
  const primary = buildPrimarySchema(options) as MdxRoot
  const dp: DialectProfile = {
    dialect: 'mdx',
    profile: () => context().project.mdx
  }
  primary.toc = () => buildTocSchema(dp)
  primary.excerpt = (projectionOptions?: ExcerptSchemaOptions) => buildExcerptSchema(dp, projectionOptions)
  primary.metadata = () => buildMetadataSchema(dp)
  return primary
}
