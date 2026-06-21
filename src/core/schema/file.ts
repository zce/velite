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
import { posix } from '../util/path'
import { context } from './context'

// A relative path is a candidate asset reference: not a fragment, query, scheme
// URL, or absolute path. Pure port of `isRelativePath` from `src/assets/process.ts`.
const isRelativePath = (value: string): boolean => {
  if (value.startsWith('#') || value.startsWith('?') || value.startsWith('//')) return false
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) return false // scheme://...
  if (/^(\/[^/\\]|[a-zA-Z]:\\)/.test(value)) return false // absolute path
  return true
}

/**
 * Strip a trailing `?query` and/or `#hash` from an asset reference. Cache-busting
 * suffixes are common on asset urls and must not reach the filesystem. Pure port
 * of the stripping done by the pre-refactor `processAsset` (src/assets/process.ts).
 */
const stripQueryAndHash = (value: string): string => {
  const queryIdx = value.indexOf('?')
  const hashIdx = value.indexOf('#')
  const index = Math.min(queryIdx >= 0 ? queryIdx : Infinity, hashIdx >= 0 ? hashIdx : Infinity)
  return index === Infinity ? value : value.slice(0, index)
}

/** Options for the {@link file} schema. */
export interface FileSchemaOptions {
  /**
   * Allow non-relative paths. When `true` (default), absolute/external values
   * are returned unchanged; relative values are copied into the asset output.
   * @default true
   */
  allowNonRelativePath?: boolean
}

/**
 * A file path relative to the current file, copied into the asset output and
 * resolved to its content-hashed public url. Non-relative paths pass through
 * unchanged when `allowNonRelativePath` is true (default).
 */
export const file = ({ allowNonRelativePath = true }: FileSchemaOptions = {}): z.ZodType<string> =>
  z.string().transform<string>(async (value, ctx) => {
    if (allowNonRelativePath && !isRelativePath(value)) return value
    try {
      const { project, file, record, asset, collectEffect } = context()
      const absSourcePath = posix.join(posix.dirname(file.path), stripQueryAndHash(value))
      const assetKey = assetKeyOf(absSourcePath, project.root)
      const result = await asset(assetKey)
      collectEffect({ type: 'asset', owner: record.id, assetPath: absSourcePath, publicUrl: result.publicUrl, isImage: false })
      return result.publicUrl
    } catch (err) {
      ctx.addIssue({ fatal: true, code: 'custom', message: err instanceof Error ? err.message : String(err) })
      return null as never
    }
  })
