import { notStrictEqual, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'

import { createSessionStore } from '../../src/runtime/store'

describe('SessionStore', () => {
  it('creates a value once per key within one store', () => {
    let created = 0
    const key = Symbol('counter')
    const store = createSessionStore()

    strictEqual(store.has(key), false)
    strictEqual(store.getOrCreate(key, () => ({ value: ++created })).value, 1)
    strictEqual(store.getOrCreate(key, () => ({ value: ++created })).value, 1)
    strictEqual(store.has(key), true)
    strictEqual(created, 1)
  })

  it('does not share values across stores', () => {
    const key = Symbol('object')
    const a = createSessionStore()
    const b = createSessionStore()

    notStrictEqual(
      a.getOrCreate(key, () => ({})),
      b.getOrCreate(key, () => ({}))
    )
  })

  it('supports explicit set and get', () => {
    const store = createSessionStore()
    const key = Symbol('value')

    strictEqual(store.get(key), undefined)
    store.set(key, 'value')
    strictEqual(store.get(key), 'value')
  })

  it('caches undefined values as real values', () => {
    let created = 0
    const key = Symbol('undefined')
    const create = () => {
      created++
      return undefined
    }
    const store = createSessionStore()

    strictEqual(store.getOrCreate(key, create), undefined)
    strictEqual(store.getOrCreate(key, create), undefined)
    strictEqual(store.has(key), true)
    strictEqual(created, 1)
  })
})
