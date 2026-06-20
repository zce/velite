import { parse } from 'yaml'

import { defineLoader } from './types'

/** Built-in loader for YAML sources. */
export const yamlLoader = defineLoader({
  test: /\.(yaml|yml)$/,
  load: source => {
    const text = typeof source.content === 'string' ? source.content : Buffer.from(source.content).toString('utf8')
    const data = parse(text)
    const records = Array.isArray(data) ? data.map((item, index) => ({ key: String(index), data: item })) : [{ data }]
    return { records }
  }
})
