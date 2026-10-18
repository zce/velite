// test/core/util/hash.tests.ts
import { equal, notEqual, ok } from 'node:assert'
import { test } from 'node:test'

import { hash } from '../../../src/core/util/hash'

test('hash: returns a 16-char hex digest', () => {
  const digest = hash('hello')
  equal(digest.length, 16)
  ok(/^[0-9a-f]{16}$/.test(digest))
})

test('hash: is deterministic for equal inputs', () => {
  equal(hash('velite'), hash('velite'))
})

test('hash: differs for different inputs', () => {
  notEqual(hash('a'), hash('b'))
})

test('hash: accepts Uint8Array', () => {
  const encoder = new TextEncoder()
  equal(hash(encoder.encode('hello')), hash('hello'))
})
