import { custom } from '../zod'

export const raw = () =>
  custom<string | undefined>(i => i === undefined || typeof i === 'string').transform<string>(async (value, ctx) => {
    return value ?? ctx.file.content ?? ''
  })
