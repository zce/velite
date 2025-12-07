import { custom } from 'zod'

import { currentFile } from './zod'

export const raw = () =>
  custom<string | undefined>(i => i === undefined || typeof i === 'string').transform<string>(value => {
    return value ?? currentFile().content ?? ''
  })
