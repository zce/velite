/**
 * @file markdown file loader
 */

import { defineLoader } from '../types'

export default defineLoader({
  name: 'markdown',
  test: /\.(md|mdx)$/,
  load: async vfile => {
    vfile.data.result = {
      content: vfile.toString()
    }
  }
})
