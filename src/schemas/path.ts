import { relative } from 'node:path'
import * as z from 'zod'

import { context } from './context'

/** Options for the flattened path schema. */
export interface PathOptions {
  /**
   * Remove a trailing `/index` segment from the flattened path.
   * @default true
   */
  removeIndex?: boolean
}

/**
 * Flattened path schema derived from the current file's project-relative path.
 */
export const path = (options?: PathOptions): z.ZodType<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(() => {
      const { project, file } = context()
      const flattened = relativePosix(project.root, file.path).replace(/\.[^.]+$/, '')
      return options?.removeIndex === false ? flattened : flattened.replace(/\/index$/, '')
    })

const relativePosix = (from: string, to: string): string => relative(from, to).replaceAll('\\', '/')
