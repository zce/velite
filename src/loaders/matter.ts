import yaml from 'yaml'

import { defineLoader } from '../types'

// https://github.com/vfile/vfile-matter/blob/main/lib/index.js
const MATTER_RE = /^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/

export default defineLoader({
  // name: 'matter',
  test: /\.(md|mdx)$/,
  load: async file => {
    const value = file.toString().trim()
    const match = value.match(MATTER_RE)
    const matter = match == null ? null : match[1]
    const data = matter == null ? {} : yaml.parse(matter) ?? {}
    const content = match == null ? value : value.slice(match[0].length).trim()
    return { data, content }
  }
})
