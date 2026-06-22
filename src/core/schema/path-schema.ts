import { z } from 'zod'

import { relative } from '../util/path'
import { context } from './context'

import type { Schema } from './s'

/** Options for the flattened {@link path} schema. */
export interface PathSchemaOptions {
  /**
   * Remove a trailing `/index` segment from the flattened path.
   * @default true
   */
  removeIndex?: boolean
}

/**
 * Flattened path schema derived from the current file's project-relative path.
 */
export const path = (options?: PathSchemaOptions): Schema<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(() => {
      const { project, file } = context()
      const flattened = relative(project.root, file.path).replace(/\.[^.]+$/, '')
      return options?.removeIndex === false ? flattened : flattened.replace(/\/index$/, '')
    })
