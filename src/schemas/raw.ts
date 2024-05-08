import { custom } from './zod'

export const raw = () => custom<string | null | undefined>().transform<string>(async (value, { meta: { content } }) => value ?? content ?? '')
