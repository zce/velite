import { custom } from 'zod'

import { context } from '../core/context'

export const raw = () =>
  custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(value => {
      return value ?? context().file.content ?? ''
    })
