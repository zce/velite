import { glob } from 'tinyglobby'

import type { Collection } from './index'

export type Discover = (root: string, patterns: Collection['pattern']) => Promise<string[]>

/**
 * Glob collection patterns relative to `root`, returning absolute file paths.
 *
 * Forwards to `tinyglobby` with the same file discovery semantics the legacy
 * resolver used.
 */
export const discover: Discover = (root, patterns) => glob(patterns, { cwd: root, absolute: true, onlyFiles: true, ignore: ['**/_*'] })
