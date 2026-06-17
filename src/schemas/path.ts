import { relative } from 'node:path'
import { custom } from 'zod'

import { context } from '../core/context'

/**
 * Options for flattened path
 * extraction
 */
export interface PathOptions {
  /**
   * removes `index` from the path
   * for subfolders
   *
   * @default true
   */
  removeIndex?: boolean
}

/**
 * Flattened path
 * @param options - options for the path flattening
 *
 * @returns flattened path based on the file path
 */
export const path = (options?: PathOptions) =>
  custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async () => {
      const { config, file } = context()

      const flattened = relative(config.root, file.path)
        .replace(/\.[^.]+$/, '')
        .replace(/\\/g, '/')

      return options?.removeIndex === false ? flattened : flattened.replace(/\/index$/, '')
    })
