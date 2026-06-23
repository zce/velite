import { equal } from 'node:assert/strict'
import { test } from 'node:test'

import { createCollectDerivation } from '../../../src/core/pipeline/collect'

import type { ResolvedConfig } from '../../../src/core/config'
import type { Context, Derivation } from '../../../src/core/engine'
import type { Source } from '../../../src/core/model'
import type { Validated } from '../../../src/core/pipeline'

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

test('collect validates sources concurrently within one collection', async () => {
  let active = 0
  let maxActive = 0

  const sources: Derivation<string, Source[]> = {
    name: 'sources',
    compute: () => [
      { id: 'a.md', path: 'a.md', absPath: '/content/a.md' },
      { id: 'b.md', path: 'b.md', absPath: '/content/b.md' },
      { id: 'c.md', path: 'c.md', absPath: '/content/c.md' }
    ]
  }

  const validate: Derivation<{ collection: string; path: string }, Validated> = {
    name: 'validate',
    async compute(_context, key) {
      active++
      maxActive = Math.max(maxActive, active)
      await delay(10)
      active--
      return { entries: [{ id: `${key.path}#`, source: key.path, data: { path: key.path } }], effects: [], diagnostics: [] }
    }
  }

  const collect = createCollectDerivation({ collections: [{ name: 'docs', single: false }] } as ResolvedConfig, sources, validate)

  const context: Context = {
    get(derivation, key) {
      return Promise.resolve(derivation.compute(context, key)) as never
    },
    input() {
      throw new Error('unexpected input read')
    }
  }

  await collect.compute(context, 'docs')

  equal(maxActive, 3)
})
