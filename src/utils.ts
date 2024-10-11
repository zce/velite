import { relative } from 'node:path'
import pm from 'picomatch'

export const matchPatterns = (input: string, patterns: string | string[], base?: string) => {
  const list = Array.isArray(patterns) ? patterns : [patterns]

  // TODO: groupBy in feature
  const { normal, negated } = list.reduce(
    (acc, p) => {
      acc[p.startsWith('!') ? 'negated' : 'normal'].push(p)
      return acc
    },
    { normal: [] as string[], negated: [] as string[] }
  )

  if (base != null) {
    input = relative(base, input).replace(/^\.[\\/]/, '')
  }

  input = input.replaceAll('\\', '/')

  return normal.some(i => pm(i)(input)) && negated.every(i => pm(i)(input))
}
