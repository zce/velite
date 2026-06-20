import { equal } from 'node:assert'
import { test } from 'node:test'

import { createSession } from '../../src/core/session'

test('session stores are isolated and getOrCreate initializes once', () => {
  const a = createSession()
  const b = createSession()
  const key = Symbol('key')

  equal(
    a.store.getOrCreate(key, () => 1),
    1
  )
  equal(
    a.store.getOrCreate(key, () => 2),
    1
  )
  equal(b.store.get(key), undefined)
  equal('set' in a.store, false)
})

test('session store has/get behave consistently', () => {
  const session = createSession()
  const key = 'my-key'

  equal(session.store.has(key), false)
  session.store.getOrCreate(key, () => ({ count: 0 }))
  equal(session.store.has(key), true)
  equal(session.store.get<{ count: number }>(key)?.count, 0)
})

test('a fresh session has no snapshot and empty diagnostics', () => {
  const session = createSession()
  equal(session.snapshot, undefined)
  equal(session.diagnostics.length, 0)
})
