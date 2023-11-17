/**
 * @file json file loader
 */

import { defineLoader } from '../types'

export default defineLoader({
  name: 'json',
  test: /\.json$/,
  load: async vfile => {
    return JSON.parse(vfile.toString())
  }
})
