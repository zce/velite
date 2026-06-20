import { equal } from 'node:assert'
import { test } from 'node:test'

import { createCacheRegistry } from '../../src/core/cache'

test('cache invalidates by owner', () => {
  const cache = createCacheRegistry()
  cache.set('loader', 'posts/a.md', 'key-a', { value: 1 })
  cache.set('loader', 'posts/b.md', 'key-b', { value: 2 })

  cache.invalidateOwner('posts/a.md')

  equal(cache.get('loader', 'key-a'), undefined)
  equal(cache.get<{ value: number }>('loader', 'key-b')?.value, 2)
})

test('cache namespaces do not share key space', () => {
  const cache = createCacheRegistry()
  cache.set('loader', 'owner', 'shared', 1)
  cache.set('schema', 'owner', 'shared', 2)
  equal(cache.get('loader', 'shared'), 1)
  equal(cache.get('schema', 'shared'), 2)
})

test('invalidateNamespace clears only that namespace', () => {
  const cache = createCacheRegistry()
  cache.set('asset', 'owner', 'k', 1)
  cache.set('output', 'owner', 'k', 2)
  equal(cache.invalidateNamespace('asset'), 1)
  equal(cache.get('asset', 'k'), undefined)
  equal(cache.get('output', 'k'), 2)
})
