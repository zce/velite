// Unit tests for the concurrency pool: limit enforcement, ordering of queued
// tasks, error propagation, and drain semantics. Pure JS — no engine, no fs.
import { equal, ok, rejects } from 'node:assert/strict'
import { test } from 'node:test'

import { createPool } from '../../src/core/util/pool'

const tick = (ms = 0): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

test('pool: runs tasks with the configured concurrency limit', async () => {
  const pool = createPool(2)
  let active = 0
  let maxActive = 0
  const tracked = async (label: string): Promise<string> => {
    active++
    maxActive = Math.max(maxActive, active)
    await tick(10)
    active--
    return label
  }

  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => pool.run(() => tracked(`t${i}`))))
  equal(results.length, 6)
  equal(maxActive, 2, 'never more than `limit` tasks run at once')
  ok(maxActive >= 2, 'actually uses the available parallelism')
})

test('pool: limit of 1 serializes tasks', async () => {
  const pool = createPool(1)
  const order: string[] = []
  const task = (label: string): Promise<void> =>
    pool.run(async () => {
      order.push(`start ${label}`)
      await tick(5)
      order.push(`end ${label}`)
    })
  await Promise.all([task('a'), task('b'), task('c')])
  // Serialized: each task fully completes before the next starts.
  equal(order.join(','), 'start a,end a,start b,end b,start c,end c')
})

test('pool: returns each task value and propagates rejections', async () => {
  const pool = createPool(2)
  const a = pool.run(async () => 1)
  const b = pool.run(async () => {
    throw new Error('boom')
  })
  equal(await a, 1)
  await rejects(b, /boom/)
})

test('pool: drain resolves once all queued and in-flight tasks settle', async () => {
  const pool = createPool(2)
  let completed = 0
  const tasks = Array.from({ length: 5 }, () =>
    pool.run(async () => {
      await tick(5)
      completed++
    })
  )
  await pool.drain()
  equal(completed, 5, 'drain waits for every submitted task')
  // After drain the pool is idle.
  equal(pool.active, 0)
  equal(pool.pending, 0)
  // Resolve the submitted tasks (already settled) to avoid unhandled rejections.
  await Promise.all(tasks)
})

test('pool: drain on an idle pool resolves immediately', async () => {
  const pool = createPool(4)
  await pool.drain()
  equal(pool.active, 0)
  equal(pool.pending, 0)
})

test('pool: clamps a sub-1 limit to 1', async () => {
  const pool = createPool(0)
  const order: string[] = []
  await Promise.all([
    pool.run(async () => {
      order.push('a')
      await tick(2)
    }),
    pool.run(async () => {
      order.push('b')
    })
  ])
  equal(order.length, 2)
})
