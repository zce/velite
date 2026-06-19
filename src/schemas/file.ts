import { string } from 'zod'

import { assetStoreKey, createAssetStore, isRelativePath, processAsset } from '../assets'
import { internalContext } from '../runtime/context'

export interface FileOptions {
  /**
   * allow non-relative path, if true, the value will be returned directly,
   * if false, the value will be processed as a relative path
   * @default true
   */
  allowNonRelativePath?: boolean
}

/**
 * A file path relative to this file.
 */
export const file = ({ allowNonRelativePath = true }: FileOptions = {}) =>
  string().transform<string>(async (value, ctx) => {
    try {
      if (allowNonRelativePath && !isRelativePath(value)) return value
      const { file, config, store } = internalContext()
      const assets = store.getOrCreate(assetStoreKey, createAssetStore)
      return await processAsset(value, file.path, config.output.name, config.output.base, assets)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.addIssue({ fatal: true, code: 'custom', message, continue: false })
      return null as never
    }
  })
