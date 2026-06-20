import { normalize, relative } from 'node:path'
import pm from 'picomatch'
import { glob } from 'tinyglobby'

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

/**
 * Glob collection patterns relative to `root`, returning absolute file paths.
 */
export const discover = (root: string, patterns: string | string[]): Promise<string[]> =>
  glob(patterns, { cwd: root, absolute: true, onlyFiles: true, ignore: ['**/_*'] })

/**
 * Normalize an array of paths into a Set of normalized absolute paths.
 */
export const normalizePathSet = (paths: readonly string[]): Set<string> => new Set(paths.map(path => normalize(path)))

/**
 * Whether any path in `paths` matches the given glob `pattern` relative to `root`.
 */
export const collectionAffected = (root: string, pattern: string | string[], paths: Set<string>): boolean => {
  for (const path of paths) {
    const rel = relative(root, path).replace(/\\/g, '/')
    if (matchPatterns(rel, pattern)) return true
  }
  return false
}
