import { relative } from 'node:path'
import pm from 'picomatch'

/**
 * Match a path against one or more globs, supporting `!negated` patterns.
 *
 * If `base` is provided, `input` is normalised relative to it before matching.
 */
export const matchPatterns = (input: string, patterns: string | string[], base?: string): boolean => {
  const list = Array.isArray(patterns) ? patterns : [patterns]

  const normal: string[] = []
  const negated: string[] = []
  for (const p of list) {
    if (p.startsWith('!')) negated.push(p)
    else normal.push(p)
  }

  if (base != null) {
    input = relative(base, input).replace(/^\.[\\/]/, '')
  }

  input = input.replaceAll('\\', '/')

  return normal.some(p => pm(p)(input)) && negated.every(p => pm(p)(input))
}
