import { defineLoader } from '../types'

export default defineLoader({
  // name: 'json',
  test: /\.json$/,
  load: file => ({
    data: JSON.parse(file.toString())
  })
})
