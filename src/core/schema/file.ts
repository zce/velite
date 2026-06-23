// `s.file()` schema: resolves a content-relative file reference into its public
// url, emitting an `AssetReferenceEffect` so the driver copies the file and the
// two-pass asset flow can resolve its content-hashed url.
//
// Ported from the pre-refactor `src/schemas/file.ts`, adapted to the new
// schema context (`context().asset(assetKey)` + `collectEffect`) and the
// engine-driven asset derivation. Non-relative paths (absolute paths, URLs,
// fragments) pass through unchanged when `allowNonRelativePath` is true.

import { z } from 'zod'

import { assetKeyOf } from '../pipeline/asset'
import { dirname, join, stripQueryAndHash } from '../util/path'
import { context } from './context'

// A relative path is a candidate asset reference: not a fragment, query, scheme
// URL, or absolute path. Pure port of `isRelativePath` from `src/assets/process.ts`.
const isRelativePath = (value: string): boolean => {
  if (value.startsWith('#') || value.startsWith('?') || value.startsWith('//')) return false
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) return false // scheme://...
  if (/^(\/[^/\\]|[a-zA-Z]:\\)/.test(value)) return false // absolute path
  return true
}

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
      const { project, file, record, asset, collectEffect } = context()
      const absSourcePath = join(dirname(file.path), stripQueryAndHash(value))
      const assetKey = assetKeyOf(absSourcePath, project.root)
      const template = outputName ?? project.output.name
      const result = await asset(assetKey, { template })
      collectEffect({ type: 'asset', owner: record.id, assetPath: absSourcePath, publicUrl: result.publicUrl, resolved: result.resolved, isImage: false })
      return result.publicUrl
    } catch (err) {
      addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
      return null as never
    }
  })
