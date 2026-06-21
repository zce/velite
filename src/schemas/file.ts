import * as z from 'zod'

import { isRelativePath, processAsset } from '../assets/process'
import { context } from './context'

/** Options for the file schema. */
export interface FileOptions {
  /**
   * Allow non-relative paths. When `true` (default), absolute/external values
   * are returned unchanged; relative values are copied into the asset output.
   * @default true
   */
  allowNonRelativePath?: boolean
}

/** A file path relative to the current file, copied into the asset output. */
export const file = ({ allowNonRelativePath = true }: FileOptions = {}): z.ZodType<string> =>
  z.string().transform<string>(async (value, ctx) => {
    try {
      if (allowNonRelativePath && !isRelativePath(value)) return value
      const { file, project, assetStore, assetCache, record, collectEffect } = context()
      const result = await processAsset({
        input: value,
        from: file.path,
        filename: project.output.name,
        baseUrl: project.output.base,
        assets: assetStore,
        cache: assetCache
      })
      collectEffect({ type: 'asset', owner: record.id, assetPath: result.sourcePath, publicUrl: result.publicUrl, isImage: false })
      return result.publicUrl
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.addIssue({ fatal: true, code: 'custom', message })
      return null as never
    }
  })
