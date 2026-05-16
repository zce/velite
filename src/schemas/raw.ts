import { custom } from 'zod'

import { context } from '../context'

export const raw = () =>
  custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(value => {
      return value ?? context().file.content ?? ''
    })
