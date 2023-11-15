/**
 * @file json file loader
 */

import { defineLoader } from '../types'

export default defineLoader({
  name: 'json',
  test: /\.json$/,
  load: async vfile => {
    vfile.data.result = JSON.parse(vfile.toString())
  }
})
