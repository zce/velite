import { custom } from './zod'

export const raw = () => custom<string>().transform<string>(async (value, { meta: { content } }) => value ?? content ?? '')
