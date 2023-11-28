import yaml from 'yaml'

import type { Loader } from '.'

export default {
  name: 'yaml',
  test: /\.(yaml|yml)$/,
  load: async file => {
    return yaml.parse(file.toString())
  }
} satisfies Loader
