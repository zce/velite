import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { string } from 'zod'

import { assetStoreKey, getImageMetadata, processAsset } from '../core/assets'
import { context } from '../core/context'

import type { BlurOptions, Image } from '../core/assets'

export interface ImageOptions {
  /**
   * root path for absolute path, if provided, the value will be processed as an absolute path
   * @default undefined
   */
  absoluteRoot?: string
  /**
   * blur placeholder options (width / height / quality)
   * @default undefined
   */
  blur?: BlurOptions
}

/**
 * Image schema.
 */
export const image = ({ absoluteRoot, blur }: ImageOptions = {}) =>
  string().transform<Image>(async (value, ctx) => {
    try {
      if (absoluteRoot && /^\//.test(value)) {
        const buffer = await readFile(join(absoluteRoot, value))
        const metadata = await getImageMetadata(buffer, blur)
        if (metadata == null) throw new Error(`Failed to get image metadata: ${value}`)
        return { src: value, ...metadata }
      }

      const { file, config, store } = context()
      const assets = store.get(assetStoreKey)

      // process asset as relative path
      return await processAsset(value, file.path, config.output.name, config.output.base, assets, true, blur)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.addIssue({ fatal: true, code: 'custom', message })
      return null as never
    }
  })
