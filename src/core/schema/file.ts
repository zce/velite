// `s.file()` schema: resolves a content-relative file reference into its public
// url, emitting an `AssetReferenceEffect` so the driver copies the file and the
// two-pass asset flow can resolve its content-hashed url.
//
// Non-relative paths (absolute paths, URLs, fragments) pass through unchanged
// when `allowNonRelativePath` is true.

import { z } from 'zod'

import { assetKeyOf } from '../assets'
import { dirname, isRelativePath, join, stripQueryAndHash } from '../util/path'
import { context } from './context'
import { builtinDeclarationContext } from './effects'

/** Options for the {@link file} schema. */
export interface FileSchemaOptions {
  /**
   * Allow non-relative paths. When `true` (default), absolute/external values
   * are returned unchanged; relative values are copied into the asset output.
   * @default true
   */
  allowNonRelativePath?: boolean
  /**
   * Per-schema override of the global `output.name` template.
   * Supports `[name]`, `[hash]`, `[hash:N]`, `[ext]`, and `/` for subdirectories.
   * @example 'docs/[name]-[hash:8].[ext]'
   */
  outputName?: string
}

/**
 * A file path relative to the current file, copied into the asset output and
 * resolved to its content-hashed public url. Non-relative paths pass through
 * unchanged when `allowNonRelativePath` is true (default).
 */
export const file = ({ allowNonRelativePath = true, outputName }: FileSchemaOptions = {}): z.ZodType<string> =>
  z.string().transform<string>(async (value, { addIssue }) => {
    if (allowNonRelativePath && !isRelativePath(value)) return value
    try {
      const { project, file, asset, collectEffect } = context()
      const absSourcePath = join(dirname(file.path), stripQueryAndHash(value))
      const assetKey = assetKeyOf(absSourcePath, project.root)
      const template = outputName ?? project.output.name
      const result = await asset(assetKey, { template })
      collectEffect({ type: 'asset', source: absSourcePath, output: { base: project.output.base, template }, metadata: false }, builtinDeclarationContext)
      return result.publicUrl
    } catch (err) {
      addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
      return z.NEVER
    }
  })
