import { z } from 'zod'

import { context } from './context'

import type { Schema } from './s'

/** Return the raw content body of the current file. */
export const raw = (): Schema<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(value => value ?? context().file.content ?? '')
