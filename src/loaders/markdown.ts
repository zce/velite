/**
 * @file markdown file loader
 */

import yaml from 'yaml'

import { defineLoader } from '../types'

export default defineLoader({
  name: 'markdown',
  test: /\.(md|mdx)$/,
  load: async vfile => {
    const content = vfile.toString()
    // https://github.com/vfile/vfile-matter/blob/main/lib/index.js
    const match = content.match(/^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/)
    if (match == null) {
      return { body: content }
    }

    // TODO: output file meta data for later use

    const data = yaml.parse(match[1])
    const raw = content.slice(match[0].length).trim()
    // keep original content with multiple keys in vfile.data for later use
    return Object.assign(data, { raw, excerpt: raw, plain: raw, html: raw, body: raw, code: raw })
  }
})
