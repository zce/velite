import { relative } from 'node:path'
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

  let rel = input
  if (base != null) {
    rel = relative(base, input).replace(/^\.[\\/]/, '')
  }
  rel = rel.replaceAll('\\', '/')

  return normal.some(p => pm(p)(rel)) && negated.every(p => pm(p)(rel))
}

/**
 * Glob collection patterns relative to `root`, returning absolute file paths.
 *
 * Files or directories starting with `_` are ignored (Velite convention for
 * partials/drafts that should not be treated as content sources).
 */
export const discover = (root: string, patterns: string | string[]): Promise<string[]> =>
  glob(patterns, { cwd: root, absolute: true, onlyFiles: true, ignore: ['**/_*'] })

/** Whether any path in `paths` matches `pattern` relative to `root`. */
export const collectionAffected = (root: string, pattern: string | string[], paths: ReadonlySet<string>): boolean => {
  for (const path of paths) {
    const rel = relative(root, path).replace(/\\/g, '/')
    if (matchPatterns(rel, pattern)) return true
  }
  return false
}
