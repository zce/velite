import { isRelativePath, processAsset } from '../assets'
import { string } from './zod'

export interface FileOptions {
  /**
   * allow non-relative path
   * @default true
   */
  allowNonRelativePath?: boolean
}

/**
 * A file path relative to this file.
 */
export const file = ({ allowNonRelativePath = true }: FileOptions = {}) =>
  string().transform<string>((value, { meta: { path, config }, addIssue }) => {
    if (allowNonRelativePath && !isRelativePath(value)) return value
    return processAsset(value, path, config.output.name, config.output.base).catch(err => {
      addIssue({ code: 'custom', message: err.message })
      return null as never
    })
  })
