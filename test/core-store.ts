import { notStrictEqual, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'

import { createSessionStore, defineStoreKey } from '../src/core/store'

describe('SessionStore', () => {
  it('creates a value once per key within one store', () => {
    let created = 0
    const key = defineStoreKey('counter', () => ({ value: ++created }))
    const store = createSessionStore()

    strictEqual(store.has(key), false)
    strictEqual(store.get(key).value, 1)
    strictEqual(store.get(key).value, 1)
    strictEqual(store.has(key), true)
    strictEqual(created, 1)
  })

  it('does not share values across stores', () => {
    const key = defineStoreKey('object', () => ({}))
    const a = createSessionStore()
    const b = createSessionStore()

    notStrictEqual(a.get(key), b.get(key))
  })

  it('treats keys with the same description as distinct keys', () => {
    const store = createSessionStore()
    const a = defineStoreKey('same', () => 'a')
    const b = defineStoreKey('same', () => 'b')

    strictEqual(store.get(a), 'a')
    strictEqual(store.get(b), 'b')
  })
})
