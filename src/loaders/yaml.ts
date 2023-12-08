import yaml from 'yaml'

import { defineLoader } from '../types'

export default defineLoader({
  // name: 'yaml',
  test: /\.(yaml|yml)$/,
  load: file => ({
    data: yaml.parse(file.toString())
  })
})
