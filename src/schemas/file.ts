import { processAsset } from '../assets'
import { string } from './zod'

// export interface FileOptions {
//   /**
//    * If the file is required.
//    */
//   failedIfNotExists?: boolean
// }
// TODO: add failedIfNotExists option
/**
 * A file path relative to this file.
 */
export const file = () =>
  string().transform((value, { meta: { file, config }, addIssue }) =>
    processAsset(value, file.path, config.output.name, config.output.base).catch(err => {
      addIssue({ code: 'custom', message: err.message })
      // file.message(err.message, { source: path.join('.') })
      return value
    })
  )
