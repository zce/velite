import { glob } from 'tinyglobby'

import type { Collection } from './index'

export interface Discoverer {
  /** Glob collection patterns relative to `root`, returning absolute file paths. */
  discover(root: string, patterns: Collection['pattern']): Promise<string[]>
}

/**
 * Create a content discoverer.
 *
 * The implementation forwards to `tinyglobby` with the same file discovery
 * semantics the legacy resolver used.
 */
export const createDiscoverer = (): Discoverer => ({
  async discover(root, patterns) {
    return glob(patterns, { cwd: root, absolute: true, onlyFiles: true, ignore: ['**/_*'] })
  }
})
