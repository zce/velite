import yaml from 'yaml'

import { defineLoader } from '../types'

export default defineLoader({
  test: /\.(yaml|yml)$/,
  load: file => ({
    data: yaml.parse(file.toString())
  })
})
