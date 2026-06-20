import * as z from 'zod'

import { getContext } from './context'

/** Return the raw content body of the current file. */
export const raw = (): z.ZodType<string> =>
  z
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(value => value ?? getContext().file.content ?? '')
