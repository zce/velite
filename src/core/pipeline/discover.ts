import { compareStrings } from '../util/compare'
import { TREE } from './inputs'

import type { Derivation } from '../engine'
import type { Source } from '../model'
import type { Matcher } from '../util/glob'
import type { TreeFile } from './inputs'

/**
 * `sources(collection)` → the ordered set of files matching a collection.
 * Pure: reads the tree snapshot input and filters by the collection's globs.
 */
export const createSourcesDerivation = (matchers: Map<string, Matcher>): Derivation<string, Source[]> => ({
  name: 'sources',
  compute(context, collection) {
    const matcher = matchers.get(collection)
    if (matcher === undefined) return []
    const tree = context.input<TreeFile[]>(TREE)
    return tree
      .filter(file => matcher(file.path))
      .map(file => ({ path: file.path, absPath: file.absPath, collection, stat: file.stat }))
      .sort((a, b) => compareStrings(a.path, b.path))
  }
})
