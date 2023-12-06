import yaml from 'yaml'

import { defineLoader } from '../config'

export default defineLoader({
  // name: 'yaml',
  test: /\.(yaml|yml)$/,
  load: file => ({
    data: yaml.parse(file.toString())
  })
})
