import { strictEqual } from 'node:assert'
import { describe, it } from 'node:test'

import { createUniqueStore } from '../../src/schemas/unique'

describe('UniqueStore', () => {
  it('register returns undefined the first time a value is registered', () => {
    const store = createUniqueStore()
    strictEqual(store.register('group', 'foo', '/site/a.md'), undefined)
  })

  it('register returns the conflicting file path on duplicate', () => {
    const store = createUniqueStore()
    store.register('group', 'foo', '/site/a.md')
    strictEqual(store.register('group', 'foo', '/site/b.md'), '/site/a.md')
  })

  it('different groups do not collide', () => {
    const store = createUniqueStore()
    store.register('a', 'foo', '/x.md')
    strictEqual(store.register('b', 'foo', '/y.md'), undefined)
  })

  it('group separator is null character so values containing the group name do not collide', () => {
    const store = createUniqueStore()
    // 'a' + '\0' + 'b:c' would collide with 'a:b' + '\0' + 'c' if we used ':'
    store.register('a', 'b:c', '/x.md')
    strictEqual(store.register('a:b', 'c', '/y.md'), undefined)
  })

  it('independent stores do not share values', () => {
    const a = createUniqueStore()
    const b = createUniqueStore()
    strictEqual(a.register('g', 'v', '/x'), undefined)
    strictEqual(b.register('g', 'v', '/y'), undefined, 'a fresh store should not see another store values')
  })

  it('invalidate removes values owned by one file without clearing other files', () => {
    const store = createUniqueStore()
    store.register('g', 'a', '/a.md')
    store.register('g', 'b', '/b.md')

    store.invalidate('/a.md')

    strictEqual(store.register('g', 'a', '/c.md'), undefined)
    strictEqual(store.register('g', 'b', '/c.md'), '/b.md')
  })
})
