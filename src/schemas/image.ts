import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { getImageMetadata, processAsset } from '../assets'
import { string } from './zod'

import type { BlurOptions, Image } from '../assets'

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
  // /**
  //  * allow remote url
  //  * @default false
  //  */
  // allowRemoteUrl?: boolean
}

/**
 * Image schema
 */
export const image = ({ absoluteRoot, blur }: ImageOptions = {}) =>
  string().transform<Image>(async (value, { meta, addIssue }) => {
    try {
      if (absoluteRoot && /^\//.test(value)) {
        const buffer = await readFile(join(absoluteRoot, value))
        const metadata = await getImageMetadata(buffer, blur)
        if (metadata == null) throw new Error(`Failed to get image metadata: ${value}`)
        return { src: value, ...metadata }
      }

      // TODO: is it necessary to allow remote url?
      // if (allowRemoteUrl && /^https?:\/\//.test(value)) {
      //   const response = await fetch(value)
      //   const blob = await response.blob()
      //   const buffer = await blob.arrayBuffer()
      //   const metadata = await getImageMetadata(Buffer.from(buffer))
      //   if (metadata == null) throw new Error(`Failed to get image metadata: ${value}`)
      //   return { src: value, ...metadata }
      // }

      const { output } = meta.config
      // process asset as relative path
      return await processAsset(value, meta.path, output.name, output.base, true, blur)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addIssue({ fatal: true, code: 'custom', message })
      return null as never
    }
  })
