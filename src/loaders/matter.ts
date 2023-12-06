import yaml from 'yaml'

import { defineLoader } from '../config'

// https://github.com/vfile/vfile-matter/blob/main/lib/index.js
const matterRegex = /^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/

export default defineLoader({
  // name: 'matter',
  test: /\.(md|mdx)$/,
  load: async file => {
    const raw = file.toString().trim()
    const match = raw.match(matterRegex)
    return {
      data: match == null ? {} : yaml.parse(match[1]),
      content: match == null ? raw : raw.slice(match[0].length).trim()
    }
  }
})
