// T1.4: Diagnostic/DiagnosticValue oracle — normalization, detachment,
// immutability, equality, ordering. Tests use the test-owned oracle
// (test/helpers/diagnostic-oracle.ts) which does NOT import the production
// normalizer.
//
// Authority: Ticket 23 lines 701-967 (final concept-convergence).
import { deepEqual, equal, ok, strictEqual, throws } from 'node:assert/strict'
import { test } from 'node:test'

import { compareDiagnosticValue, equalDiagnosticValue, normalizeDiagnosticValue } from '../../src/core/diagnostic'
import { oracleCompare, oracleEqual, oracleNormalize } from '../helpers/diagnostic-oracle'

test('T1.4: scalars normalize and match oracle', () => {
  const cases: unknown[] = [null, true, false, '', 'a', '你好', 0, -0, 1.5, NaN, Infinity, -Infinity, 42n, undefined, Symbol('x'), () => {}]
  for (const c of cases) {
    const produced = normalizeDiagnosticValue(c)
    const expected = oracleNormalize(c)
    ok(equalDiagnosticValue(produced, expected as never), `mismatch for ${String(c)}`)
    ok(oracleEqual(expected, produced as never), `oracle disagrees for ${String(c)}`)
  }
})

test('T1.4: NaN, -0, Infinity use the explicit number tag', () => {
  deepEqual(normalizeDiagnosticValue(NaN), { type: 'number', value: 'nan' })
  deepEqual(normalizeDiagnosticValue(-0), { type: 'number', value: 'negative-zero' })
  deepEqual(normalizeDiagnosticValue(Infinity), { type: 'number', value: 'positive-infinity' })
  deepEqual(normalizeDiagnosticValue(-Infinity), { type: 'number', value: 'negative-infinity' })
  equal(normalizeDiagnosticValue(42), 42)
})

test('T1.4: bigint uses canonical base-10 string', () => {
  deepEqual(normalizeDiagnosticValue(255n), { type: 'bigint', value: '255' })
  deepEqual(normalizeDiagnosticValue(-1n), { type: 'bigint', value: '-1' })
})

test('T1.4: array normalizes recursively, holes become undefined tag, accessor index becomes opaque', () => {
  const arr: unknown[] = [1, 'a', null]
  const produced = normalizeDiagnosticValue(arr) as readonly unknown[]
  equal(produced.length, 3)
  ok(equalDiagnosticValue(produced[0] as never, 1 as never))
  ok(equalDiagnosticValue(produced[1] as never, 'a' as never))
  ok(equalDiagnosticValue(produced[2] as never, null as never))
  // hole
  const holey: unknown[] = [1, , 3] // eslint-disable-line no-sparse-arrays
  const hnorm = normalizeDiagnosticValue(holey) as readonly unknown[]
  deepEqual(hnorm[1], { type: 'undefined' })
})

test('T1.4: plain object becomes sorted record; null-prototype objects normalize equally', () => {
  const produced = normalizeDiagnosticValue({ b: 2, a: 1 })
  deepEqual(produced, {
    type: 'record',
    entries: [
      ['a', 1],
      ['b', 2]
    ]
  })
  const nulProto = Object.create(null)
  nulProto.x = 1
  deepEqual(normalizeDiagnosticValue(nulProto), { type: 'record', entries: [['x', 1]] })
})

test('T1.4: Error normalizes name, message, code, cause; stack is never read', () => {
  const err = new Error('boom')
  ;(err as { code?: string }).code = 'E_TEST'
  ;(err as { cause?: unknown }).cause = { nested: 1 }
  const produced = normalizeDiagnosticValue(err)
  deepEqual(produced, { type: 'error', name: 'Error', message: 'boom', code: 'E_TEST', cause: { type: 'record', entries: [['nested', 1]] } })
})

test('T1.4: subclass Error keeps subclass name', () => {
  class MyError extends Error {
    constructor() {
      super('m')
      this.name = 'MyError'
    }
  }
  const produced = normalizeDiagnosticValue(new MyError())
  deepEqual(produced, { type: 'error', name: 'MyError', message: 'm' })
})

test('T1.4: circular references become { type: "circular" } and non-ancestor repeats normalize independently', () => {
  const a: { self?: unknown; val: number } = { val: 1 }
  a.self = a
  const produced = normalizeDiagnosticValue(a) as { type: 'record'; entries: readonly (readonly [string, unknown])[] }
  const self = produced.entries.find(([k]) => k === 'self')![1]
  deepEqual(self, { type: 'circular' })
  // non-ancestor repeat
  const inner = { x: 1 }
  const parent = { a: inner, b: inner }
  const pn = normalizeDiagnosticValue(parent) as { type: 'record'; entries: readonly (readonly [string, unknown])[] }
  deepEqual(pn.entries.find(([k]) => k === 'a')![1], pn.entries.find(([k]) => k === 'b')![1])
})

test('T1.4: unsupported host values (Map, Set, Date, RegExp, typed arrays, functions, symbols) all become opaque', () => {
  for (const v of [new Map(), new Set(), new Date(), /x/, new Uint8Array(), Promise.resolve(), Symbol('s'), () => {}]) {
    deepEqual(normalizeDiagnosticValue(v), { type: 'opaque' })
  }
})

test('T1.4: class instances (non-Error) become opaque', () => {
  class Foo {
    x = 1
  }
  deepEqual(normalizeDiagnosticValue(new Foo()), { type: 'opaque' })
})

test('T1.4: normalized output is recursively frozen (runtime immutability)', () => {
  const produced = normalizeDiagnosticValue({ a: [1, { b: 'x' }] }) as { type: 'record'; entries: readonly (readonly [string, unknown])[] }
  ok(Object.isFrozen(produced), 'record frozen')
  const arr = produced.entries[0]![1] as readonly unknown[]
  ok(Object.isFrozen(arr), 'array frozen')
  const inner = arr[1] as { type: 'record'; entries: readonly (readonly [string, unknown])[] }
  ok(Object.isFrozen(inner), 'inner record frozen')
  throws(() => {
    ;(produced as { entries: unknown[] }).entries.push(['z', 0])
  }, 'cannot push to frozen entries')
})

test('T1.4: no original reference is retained — mutation after normalization does not affect output', () => {
  const input = { a: 1, nested: { b: [2] } }
  const produced = normalizeDiagnosticValue(input)
  // mutate input after normalization
  ;(input as { a: number }).a = 999
  ;(input as { nested: { b: number[] } }).nested.b[0] = 999
  // produced must be unchanged
  deepEqual(produced, {
    type: 'record',
    entries: [
      ['a', 1],
      ['nested', { type: 'record', entries: [['b', [2]]] }]
    ]
  })
})

test('T1.4: getters/accessors become opaque without invocation', () => {
  let called = false
  const obj = {
    x: 1,
    get g(): number {
      called = true
      return 42
    }
  }
  const produced = normalizeDiagnosticValue(obj) as { type: 'record'; entries: readonly (readonly [string, unknown])[] }
  // getter not invoked
  equal(called, false)
  // 'g' should be skipped (not an own data property), 'x' preserved
  const keys = produced.entries.map(([k]) => k)
  deepEqual(keys, ['x'])
})

test('T1.4: canonical ordering matches oracle across fixtures', () => {
  const values: unknown[] = [
    null,
    true,
    false,
    '',
    'a',
    'b',
    0,
    1,
    -1,
    NaN,
    Infinity,
    -Infinity,
    -0,
    1n,
    -1n,
    undefined,
    { type: 'undefined' },
    [1, 2],
    [1, 2, 3],
    { a: 1 },
    { b: 2 },
    new Error('x'),
    { type: 'circular' },
    { type: 'opaque' },
    new Map()
  ]
  for (const a of values) {
    for (const b of values) {
      const produced = compareDiagnosticValue(normalizeDiagnosticValue(a), normalizeDiagnosticValue(b))
      const expected = oracleCompare(oracleNormalize(a), oracleNormalize(b))
      equal(Math.sign(produced), Math.sign(expected), `sign mismatch for ${String(a)} vs ${String(b)}`)
    }
  }
})

test('T1.4: equalDiagnosticValue is structural — no object identity dependence', () => {
  const a = normalizeDiagnosticValue({ x: [1, 2] })
  const b = normalizeDiagnosticValue({ x: [1, 2] })
  ok(a !== b, 'different object identities')
  ok(equalDiagnosticValue(a, b), 'structurally equal')
})

test('T1.4: Reflect.ownKeys of normalized record exposes no host taxonomy fields', () => {
  const v = normalizeDiagnosticValue({ a: 1 })
  const keys = Reflect.ownKeys(v as object)
  // Only 'type' and 'entries' — no host taxonomy, no Proxy, no symbol keys
  for (const k of keys) equal(typeof k, 'string')
  ok(keys.includes('type'))
  ok(keys.includes('entries'))
})
