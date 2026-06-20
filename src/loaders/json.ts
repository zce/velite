import { defineLoader } from './types'

/** Built-in loader for JSON sources. */
export const jsonLoader = defineLoader({
  test: /\.json$/,
  load: source => {
    const data = JSON.parse(typeof source.content === 'string' ? source.content : Buffer.from(source.content).toString('utf8'))
    const records = Array.isArray(data) ? data.map((item, index) => ({ key: String(index), data: item })) : [{ data }]
    return { records }
  }
})
