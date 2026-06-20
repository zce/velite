import { parse } from 'yaml'

import { defineLoader } from './types'

// https://github.com/vfile/vfile-matter/blob/main/lib/index.js
const MATTER_RE = /^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/

/**
 * Built-in loader for Markdown / MDX sources with YAML frontmatter.
 *
 * Produces a single record whose `data` is the parsed frontmatter. The body
 * content is attached as `metadata.content` so schemas (`s.markdown()`,
 * `s.mdx()`, `s.raw()`, ...) can fall back to it when the field value is empty.
 */
export const matterLoader = defineLoader({
  test: /\.(md|mdx)$/,
  load: source => {
    const value = (typeof source.content === 'string' ? source.content : Buffer.from(source.content).toString('utf8')).trim()
    const match = value.match(MATTER_RE)
    const frontmatter = match == null ? null : match[1]
    const data = frontmatter == null ? {} : (parse(frontmatter) ?? {})
    const content = match == null ? value : value.slice(match[0].length).trim()
    return { records: [{ data, metadata: { content } }] }
  }
})
