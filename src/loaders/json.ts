import { defineLoader } from '../config'

export default defineLoader({
  // name: 'json',
  test: /\.json$/,
  load: file => ({
    data: JSON.parse(file.toString())
  })
})
