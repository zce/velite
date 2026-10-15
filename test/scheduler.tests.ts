// Direct scheduler contract tests: debounced serial rebuilds, per-path event
// merging, accumulation during a running rebuild, and disposal semantics.
import { deepEqual, equal } from 'node:assert/strict'
import { test } from 'node:test'

import { createScheduler } from '../src/core/scheduler'

import type { FileEvent } from '../src/runtime/watcher'

const event = (absPath: string, type: FileEvent['type'] = 'change'): FileEvent => ({ type, absPath })

/** Collect batches; each run resolves after `tick` microtasks, so pushes can arrive mid-run. */
const collector = (tick = 0): { batches: FileEvent[][]; run: (events: FileEvent[]) => Promise<void> } => {
  const batches: FileEvent[][] = []
  return {
    batches,
    run: async events => {
      batches.push(events)
      for (let i = 0; i < tick; i++) await Promise.resolve()
    }
  }
}

const until = async (condition: () => boolean, timeoutMs = 2000): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for condition')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}

test('scheduler: zero debounce runs serially and merges same-path events in a batch', async () => {
  const { batches, run } = collector()
  const scheduler = createScheduler({ run, debounceMs: 0 })
  scheduler.push([event('/a'), event('/b')])
  scheduler.push([event('/a', 'unlink')])
  await until(() => batches.length > 0)
  // Both pushes coalesced into one batch; the later event for /a wins.
  deepEqual(batches[0], [event('/a', 'unlink'), event('/b')])
  scheduler.dispose()
})

test('scheduler: events pushed while a rebuild runs start another afterwards', async () => {
  const { batches, run } = collector(10)
  const scheduler = createScheduler({ run, debounceMs: 0 })
  scheduler.push([event('/a')])
  await until(() => batches.length === 1)
  // The first run is still in flight (it resolves after 10 microtasks).
  scheduler.push([event('/b')])
  await until(() => batches.length === 2)
  deepEqual(batches[1], [event('/b')])
  scheduler.dispose()
})

test('scheduler: debounce coalesces bursts within the window', async () => {
  const { batches, run } = collector()
  const scheduler = createScheduler({ run, debounceMs: 30 })
  for (let i = 0; i < 5; i++) {
    scheduler.push([event(`/file-${i}`)])
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  await until(() => batches.length === 1)
  equal(batches.length, 1, 'the whole burst ran as one batch')
  equal(batches[0]!.length, 5)
  scheduler.dispose()
})

test('scheduler: dispose cancels pending debounced runs and ignores later pushes', async () => {
  const { batches, run } = collector()
  const scheduler = createScheduler({ run, debounceMs: 20 })
  scheduler.push([event('/a')])
  scheduler.dispose()
  scheduler.push([event('/b')])
  await new Promise(resolve => setTimeout(resolve, 60))
  equal(batches.length, 0, 'nothing ran after dispose')
})
