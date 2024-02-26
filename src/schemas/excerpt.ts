import { custom } from './zod'

export interface ExcerptOptions {
  // /**
  //  * Excerpt separator.
  //  * @default 'more'
  //  * @example
  //  * s.excerpt({ separator: 'preview' }) // split excerpt by `<!-- preview -->`
  //  */
  // separator?: string
  /**
   * Excerpt length.
   * @default 260
   */
  length?: number
}

export const excerpt = ({ length = 260 }: ExcerptOptions = {}) =>
  custom<string>().transform<string>(async (value, { meta: { plain } }) => {
    if (value == null && plain != null) {
      value = plain
    }
    return value.slice(0, length)
  })
