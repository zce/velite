import yaml from 'yaml'

import { defineLoader } from '../types'

export default defineLoader({
  test: /\.(yaml|yml)$/,
  load: async file => {
    return yaml.parse(file.toString())
  }
})
