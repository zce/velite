import yaml from 'yaml'

import type { Loader } from '.'

export default {
  name: 'yaml',
  test: /\.(yaml|yml)$/,
  load: async file => {
    file.data.original = yaml.parse(file.toString())
  }
} satisfies Loader
