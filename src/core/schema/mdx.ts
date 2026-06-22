import { z } from 'zod'

import { processMdx } from '../content/mdx'
import { assetKeyOf } from '../pipeline/asset'
import { dirname, join, stripQueryAndHash } from '../util/path'
import { context } from './context'

import type { PluggableList } from 'unified'
import type { ProcessMdxOptions } from '../content/mdx'
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

/** Compile the current content body as MDX. */
export const mdx = (options: MdxSchemaOptions = {}): Schema<string> =>
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
        path: file.path,
        references: false
      }
      if (copyLinkedFiles) {
        merged.processAsset = async (url: string): Promise<string> => {
          const absSourcePath = join(dirname(file.path), stripQueryAndHash(url))
          const assetKey = assetKeyOf(absSourcePath, project.root)
          const result = await asset(assetKey, { template: project.output.name })
          collectEffect({ type: 'asset', owner: record.id, assetPath: absSourcePath, publicUrl: result.publicUrl, isImage: false })
          return result.publicUrl
        }
      }
      try {
        const { code } = await processMdx(body, merged)
        return code
      } catch (err) {
        addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
        return null as never
      }
    })
