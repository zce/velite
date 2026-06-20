import { glob } from 'tinyglobby'

/**
 * Glob collection patterns relative to `root`, returning absolute file paths.
 *
 * Forwards to `tinyglobby` with the same file discovery semantics the legacy
 * resolver used.
 */
export const discover = (root: string, patterns: string | string[]): Promise<string[]> =>
  glob(patterns, { cwd: root, absolute: true, onlyFiles: true, ignore: ['**/_*'] })
