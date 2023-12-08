import { custom } from './zod'

export interface ExcerptOptions {
  /**
   * Excerpt length.
   * @default 260
   */
  length?: number
}

export const excerpt = ({ length = 260 }: ExcerptOptions = {}) =>
  custom<string>().transform(async (value, { meta: { file } }) => {
    if (value == null && file.data.plain != null) {
      value = file.data.plain
    }
    return value.slice(0, length)
  })
