import { relative } from 'node:path'

import { custom } from './zod'

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
  custom<string | null | undefined>().transform<string>(async (value, { meta: { path, config }, addIssue }) => {
    if (value != null) {
      addIssue({ fatal: false, code: 'custom', message: '`s.path()` schema will resolve the flattening path based on the file path' })
    }

    const flattened = relative(config.root, path)
      .replace(/\.[^.]+$/, '')
      .replace(/\\/g, '/')

    return options?.removeIndex === false ? flattened : flattened.replace(/\/index$/, '')
  })
