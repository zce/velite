import { defineLoader } from '../types'

export default defineLoader({
  test: /\.json$/,
  load: file => ({
    data: JSON.parse(file.toString())
  })
})
