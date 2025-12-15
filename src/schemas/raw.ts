import { custom } from 'zod'

import { context } from '../context'

export const raw = () =>
  custom<string | undefined>(i => i === undefined || typeof i === 'string').transform<string>(value => {
    return value ?? context().file.content ?? ''
  })
