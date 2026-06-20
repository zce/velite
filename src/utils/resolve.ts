import { normalize, relative } from 'node:path'

import { matchPatterns } from './patterns'

/**
 * Normalise an array of paths into a `Set<string>` for O(1) lookup.
 */
export const normalizePathSet = (paths: readonly string[]): Set<string> => new Set(paths.map(path => normalize(path)))

/**
 * Whether any path in `paths` matches the given glob `pattern`, relative to `root`.
 */
export const collectionAffected = (root: string, pattern: string | string[], paths: Set<string>): boolean => {
  for (const path of paths) {
    const rel = relative(root, path).replace(/\\/g, '/')
    if (matchPatterns(rel, pattern)) return true
  }
  return false
}
