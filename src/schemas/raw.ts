import { custom } from './zod'

export const raw = () =>
  custom<string>().transform<string>(async (value, { meta: { content } }) => {
    if (value == null && content != null) {
      value = content
    }
    return value
  })
