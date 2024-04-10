import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { getImageMetadata, processAsset } from '../assets'
import { string } from './zod'

import type { Image } from '../assets'

export interface ImageOptions {
  /**
   * root path for absolute path, if provided, the value will be processed as an absolute path
   * @default undefined
   */
  absoluteRoot?: string
  // /**
  //  * allow remote url
  //  * @default false
  //  */
  // allowRemoteUrl?: boolean
}

/**
 * Image schema
 */
export const image = ({ absoluteRoot }: ImageOptions = {}) =>
  string().transform<Image>(async (value, { meta: { path, config }, addIssue }) => {
    try {
      if (absoluteRoot && /^\//.test(value)) {
        const buffer = await readFile(join(absoluteRoot, value))
        const metadata = await getImageMetadata(buffer)
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

      // process asset as relative path
      return await processAsset(value, path, config.output.name, config.output.base, true)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addIssue({ code: 'custom', message })
      return null as never
    }
  })
