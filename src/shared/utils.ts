import { raw } from 'hast-util-raw'
import { toString } from 'hast-util-to-string'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toHast } from 'mdast-util-to-hast'

export const markdownToPlain = (markdown: string) => {
  const mdast = fromMarkdown(markdown)
  const hast = raw(toHast(mdast, { allowDangerousHtml: true }))
  return toString(hast)
}
