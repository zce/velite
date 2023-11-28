import type { Loader } from '.'

export default {
  name: 'json',
  test: /\.json$/,
  load: async file => {
    return JSON.parse(file.toString())
  }
} satisfies Loader
