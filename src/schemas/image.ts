import { isRelativePath, processAsset } from '../assets'
import { string } from './zod'

import type { Image } from '../assets'

export interface ImageOptions {
  /**
   * allow non-relative path
   * @default false
   */
  allowNonRelativePath?: boolean
}

/**
 * A image path relative to this file.
 */
export const image = ({ allowNonRelativePath = false }: ImageOptions = {}) =>
  string().transform<Image>((value, { meta: { file, config }, addIssue }) => {
    // TODO: support absolute path metadata
    if (allowNonRelativePath && !isRelativePath(value)) return { src: value, width: 0, height: 0, blurDataURL: '', blurWidth: 0, blurHeight: 0 }
    return processAsset(value, file.path, config.output.name, config.output.base, true).catch(err => {
      addIssue({ code: 'custom', message: err.message })
      return null as never
    })
  })
