import { parse } from 'yaml'

import { defineLoader } from './types'

export default defineLoader({
  // name: 'yaml',
  test: /\.(yaml|yml)$/,
  load: file => ({
    data: parse(file.toString())
  })
})
