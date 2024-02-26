import { relative } from 'node:path'

import { custom } from './zod'

/**
 * Flattened path
 * @returns flattened path based on the file path
 */
export const path = () =>
  custom<string>().transform<string>(async (value, { meta: { path, config }, addIssue }) => {
    if (value != null) {
      addIssue({ code: 'custom', message: '`s.path()` schema will resolve the flattening path based on the file path' })
      return null as never
    }

    return relative(config.root, path)
      .replace(/\.[^.]+$/, '')
      .replace(/\\/g, '/')
      .replace(/\/index$/, '')
  })
