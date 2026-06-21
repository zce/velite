// test/core/engine.tests.ts
import { equal, ok, rejects } from 'node:assert'
import { mock, test } from 'node:test'

import { createEngine, EngineError } from '../../src/core/engine'

import type { Context, Derivation } from '../../src/core/engine'

test('engine/memo: computes once and reuses the memo on repeated demand', async () => {
  const engine = createEngine()
  const compute = mock.fn((ctx: Context) => ctx.input<number>('a') * 2)
  const double: Derivation<null, number> = { name: 'double', compute }

  engine.set('a', 21)
  equal(await engine.get(double, null), 42)
  equal(await engine.get(double, null), 42)
  equal(compute.mock.calls.length, 1)
})

test('engine/memo: setting an input to an equal value does not bump revision or recompute', async () => {
  const engine = createEngine()
  const compute = mock.fn((ctx: Context) => ctx.input<number>('a') + 1)
  const inc: Derivation<null, number> = { name: 'inc', compute }

  engine.set('a', 1)
  await engine.get(inc, null)
  const revisionAfterFirst = engine.revision

  engine.set('a', 1) // same value
  equal(engine.revision, revisionAfterFirst)
  equal(await engine.get(inc, null), 2)
  equal(compute.mock.calls.length, 1)
})

test('engine/incremental: recomputes only the affected dependency closure', async () => {
  const engine = createEngine()
  const sumFn = mock.fn((ctx: Context) => ctx.input<number>('a') + ctx.input<number>('b'))
  const sum: Derivation<null, number> = { name: 'sum', compute: sumFn }
  const otherFn = mock.fn((ctx: Context) => ctx.input<number>('c') * 10)
  const other: Derivation<null, number> = { name: 'other', compute: otherFn }

  engine.set('a', 1)
  engine.set('b', 2)
  engine.set('c', 5)

  equal(await engine.get(sum, null), 3)
  equal(await engine.get(other, null), 50)
  equal(sumFn.mock.calls.length, 1)
  equal(otherFn.mock.calls.length, 1)

  engine.set('a', 10) // touches only `sum`
  equal(await engine.get(sum, null), 12)
  equal(await engine.get(other, null), 50)
  equal(sumFn.mock.calls.length, 2)
  equal(otherFn.mock.calls.length, 1) // unrelated, not recomputed
})

test('engine/incremental: propagates changes transitively through derivation chains', async () => {
  const engine = createEngine()
  const base: Derivation<null, number> = { name: 'base', compute: ctx => ctx.input<number>('a') }
  const chainFn = mock.fn((ctx: Context) => ctx.get(base, null).then(v => v + 100))
  const chain: Derivation<null, number> = { name: 'chain', compute: chainFn }

  engine.set('a', 1)
  equal(await engine.get(chain, null), 101)

  engine.set('a', 2)
  equal(await engine.get(chain, null), 102)
  equal(chainFn.mock.calls.length, 2)
})

test('engine/backdating: does not recompute downstream when an upstream recompute yields an equal value', async () => {
  const engine = createEngine()
  const positive: Derivation<null, boolean> = {
    name: 'positive',
    compute: ctx => ctx.input<number>('a') > 0
  }
  const labelFn = mock.fn((ctx: Context) => ctx.get(positive, null).then(p => (p ? 'pos' : 'neg')))
  const label: Derivation<null, string> = { name: 'label', compute: labelFn }

  engine.set('a', 1)
  equal(await engine.get(label, null), 'pos')
  equal(labelFn.mock.calls.length, 1)

  engine.set('a', 5) // value changes, but positive(a) stays true
  equal(await engine.get(label, null), 'pos')
  equal(labelFn.mock.calls.length, 1) // backdated: label not recomputed
})

test('engine/backdating: does recompute downstream when the upstream value actually changes', async () => {
  const engine = createEngine()
  const positive: Derivation<null, boolean> = {
    name: 'positive',
    compute: ctx => ctx.input<number>('a') > 0
  }
  const labelFn = mock.fn((ctx: Context) => ctx.get(positive, null).then(p => (p ? 'pos' : 'neg')))
  const label: Derivation<null, string> = { name: 'label', compute: labelFn }

  engine.set('a', 1)
  equal(await engine.get(label, null), 'pos')

  engine.set('a', -1) // positive flips to false
  equal(await engine.get(label, null), 'neg')
  equal(labelFn.mock.calls.length, 2)
})

test('engine/keys: memoizes per key independently', async () => {
  const engine = createEngine()
  const compute = mock.fn((ctx: Context, key: string) => ctx.input<number>(key) + 1)
  const inc: Derivation<string, number> = { name: 'inc', compute }

  engine.set('a', 1)
  engine.set('b', 10)
  equal(await engine.get(inc, 'a'), 2)
  equal(await engine.get(inc, 'b'), 11)
  equal(await engine.get(inc, 'a'), 2)
  equal(compute.mock.calls.length, 2)

  engine.set('a', 100)
  equal(await engine.get(inc, 'a'), 101)
  equal(await engine.get(inc, 'b'), 11) // unaffected
  equal(compute.mock.calls.length, 3)
})

test('engine/removal: bumps revision and invalidates dependents when an input is removed', async () => {
  const engine = createEngine()
  const read: Derivation<null, number> = { name: 'read', compute: ctx => ctx.input<number>('a') }

  engine.set('a', 7)
  equal(await engine.get(read, null), 7)
  const before = engine.revision

  engine.remove('a')
  ok(engine.revision > before)
  await rejects(engine.get(read, null), EngineError)
})

test('engine/cycle: rejects a dependency cycle instead of hanging', async () => {
  const engine = createEngine()
  const a: Derivation<null, number> = { name: 'a', compute: ctx => ctx.get(b, null) }
  const b: Derivation<null, number> = { name: 'b', compute: ctx => ctx.get(a, null) }

  await rejects(engine.get(a, null), (err: unknown) => err instanceof EngineError && err.code === 'cycle')
})

test('engine/gc: drops memo entries not demanded within the kept window', async () => {
  const engine = createEngine()
  const compute = mock.fn((ctx: Context) => ctx.input<number>('a') + 1)
  const inc: Derivation<null, number> = { name: 'inc', compute }

  engine.set('a', 1)
  await engine.get(inc, null)
  equal(compute.mock.calls.length, 1)

  // Advance several revisions without demanding `inc`, then GC stale memos.
  engine.set('a', 2)
  engine.set('a', 3)
  engine.set('a', 4)
  engine.gc(1)

  // Memo was collected, so the next demand recomputes from scratch.
  equal(await engine.get(inc, null), 5)
  equal(compute.mock.calls.length, 2)
})

test('engine/error: a failed first computation is retried on next demand, not poisoned', async () => {
  const engine = createEngine()
  let calls = 0
  const flaky: Derivation<null, number> = {
    name: 'flaky',
    compute: () => {
      calls++
      throw new Error('boom')
    }
  }
  await rejects(engine.get(flaky, null), (err: unknown) => err instanceof Error && err.message === 'boom')
  await rejects(engine.get(flaky, null), (err: unknown) => err instanceof Error && err.message === 'boom')
  equal(calls, 2) // recomputed both times, not silently returned undefined
})

test('engine/cycle: a cycle error is re-thrown on retry, not poisoned', async () => {
  const engine = createEngine()
  const a: Derivation<null, number> = { name: 'a', compute: ctx => ctx.get(b, null) }
  const b: Derivation<null, number> = { name: 'b', compute: ctx => ctx.get(a, null) }
  await rejects(engine.get(a, null), (err: unknown) => err instanceof EngineError && err.code === 'cycle')
  await rejects(engine.get(a, null), (err: unknown) => err instanceof EngineError && err.code === 'cycle')
})

test('engine/inflight: concurrent identical demands compute once and share the result', async () => {
  const engine = createEngine()
  const compute = mock.fn((ctx: Context) => ctx.input<number>('a') + 1)
  const inc: Derivation<null, number> = { name: 'inc', compute }
  engine.set('a', 41)
  const [r1, r2] = await Promise.all([engine.get(inc, null), engine.get(inc, null)])
  equal(r1, 42)
  equal(r2, 42)
  equal(compute.mock.calls.length, 1)
})
