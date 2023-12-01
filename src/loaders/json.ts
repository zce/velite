import { defineLoader } from '../types'

export default defineLoader({
  test: /\.json$/,
  load: file => {
    return JSON.parse(file.toString())
  }
})
