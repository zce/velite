import { glob } from 'tinyglobby'

import type { Collection } from '../collections'

export interface Discoverer {
  /** Glob collection patterns relative to `root`, returning absolute file paths. */
  discover(root: string, patterns: Collection['pattern']): Promise<string[]>
}

export interface DiscovererDeps {
  glob: typeof glob
}

const defaultDeps: DiscovererDeps = { glob }

/**
 * Create a content discoverer.
 *
 * `deps.glob` allows tests to inject a deterministic glob; the default
 * implementation forwards to `tinyglobby` with the same file discovery
 * semantics the legacy resolver used.
 */
export const createDiscoverer = (deps: DiscovererDeps = defaultDeps): Discoverer => ({
  async discover(root, patterns) {
    return deps.glob(patterns, { cwd: root, absolute: true, onlyFiles: true, ignore: ['**/_*'] })
  }
})
