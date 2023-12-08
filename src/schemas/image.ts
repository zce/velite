import { processAsset } from '../assets'
import { string } from './zod'

import type { Image } from '../assets'

// export interface ImageOptions {
//   /**
//    * If the file is required.
//    */
//   failedIfNotExists?: boolean
// }
// TODO: add failedIfNotExists option
/**
 * A image path relative to this file.
 */
export const image = () =>
  string().transform<Image>((value, { meta: { file, config }, addIssue }) =>
    processAsset(value, file.path, config.output.name, config.output.base, true).catch(err => {
      addIssue({ code: 'custom', message: err.message })
      return null as never
    })
  )
