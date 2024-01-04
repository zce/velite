import { custom } from './zod'

export const raw = () =>
  custom<string>().transform<string>(async (value, { meta: { file } }) => {
    if (value == null && file.data.content != null) {
      value = file.data.content
    }
    return value
  })
