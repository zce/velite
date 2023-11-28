import type { Loader } from '.'

export default {
  name: 'json',
  test: /\.json$/,
  load: async file => {
    file.data.original = JSON.parse(file.toString())
  }
} satisfies Loader
