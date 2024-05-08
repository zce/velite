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
  custom<string>().transform<string>(async (value, { meta: { plain }, addIssue }) => {
    if (value != null) return value.slice(0, length)
    if (plain == null) {
      addIssue({ code: 'custom', message: 'No excerpt found' })
      return ''
    }
    return plain.slice(0, length)
  })
