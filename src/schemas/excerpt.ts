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
  custom<string | null | undefined>().transform<string>(async (value, { meta: { plain }, addIssue }) => {
    value = value ?? plain
    if (value == null || value.length === 0) {
      addIssue({ code: 'custom', message: 'Empty content' })
      return ''
    }

    return value.slice(0, length)
  })
