// Concurrency: Builder.build() and Builder.apply() share RunContext state
// (manifest, assetManifest, tree, engine inputs). Concurrent invocations must
// not interleave. The builder enforces this with an internal serialization
// queue — these tests directly observe the critical section.
//
// (a) Strict serialization: the `prepare` hook is the natural chokepoint —
//     called once per build regardless of engine memoization, inside the
//     same critical section as the manifest/tree mutations. An overlap
//     counter inside prepare proves the queue keeps max(inflight) at 1.
// (b) Watch leakage: two concurrent watch() invocations must not strand a
//     watcher — the second's setup waits for the first to complete, so its
//     closeWatch() cleanly drops the first's subscription before creating
//     a new one.
import { equal, ok } from 'node:assert/strict'
import { test } from 'node:test'

import { createBuilder, s } from '../../src/core'
import { join } from '../../src/core/util/path'
import { nodeContextStorage, silentLogger } from '../../src/runtime/adapters/node'
import { MemoryFileSystem } from '../helpers/memory-fs'
import { noopImageProcessor, noopWatch } from '../helpers/runtime'

import type { PrepareHook, UserConfig } from '../../src/core/config'
import type { TestRuntime } from '../helpers/runtime'

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

test('Builder: build() critical section is strictly serialized (max inflight = 1)', async () => {
  const CWD = '/proj'
  let inflight = 0
  let maxInflight = 0
  let prepareCalls = 0
  const prepare: PrepareHook = async () => {
    // The prepare hook is called once per build (driver always invokes it
    // regardless of engine memoization), inside the serialization critical
    // section. If two builds were running concurrently, both would enter
    // prepare and inflight would peak above 1. With the mutex, max is 1.
    inflight++
    maxInflight = Math.max(maxInflight, inflight)
    prepareCalls++
    try {
      await sleep(15)
    } finally {
      inflight--
    }
    return undefined
  }
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } },
    prepare
  }
  const fs = new MemoryFileSystem()
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }]))
  const runtime: TestRuntime = {
    contextStorage: nodeContextStorage,
    fs,
    modules: { load: async () => ({ exports: config, dependencies: [] }) },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  const builder = createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })

  const tasks = Array.from({ length: 5 }, () => builder.build({ layout: 'single' }))
  await Promise.all(tasks)

  equal(prepareCalls, 5, 'prepare was invoked once per build')
  equal(maxInflight, 1, `prepare overlapped: maxInflight=${maxInflight}`)
  await builder.dispose()
})

test('Builder: concurrent watch() invocations are serialized, no watcher leak', async () => {
  const CWD = '/proj'
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } }
  }
  const fs = new MemoryFileSystem()
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }]))
  let watcherCount = 0
  const unsubscribed: number[] = []
  const runtime: TestRuntime = {
    contextStorage: nodeContextStorage,
    fs,
    modules: { load: async () => ({ exports: config, dependencies: [] }) },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: () => {
      const id = watcherCount++
      return {
        subscribe: () => () => {
          unsubscribed.push(id)
        }
      }
    }
  }
  const builder = createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })

  // Two simultaneous watch() calls. Without serialization, both could pass
  // closeWatch() then both create watchers and the second would overwrite
  // watchState, stranding the first. With serialization, the second waits
  // for the first to fully finish setup, then its closeWatch() cleanly
  // drops the first's subscription before creating a new one.
  const [h1, h2] = await Promise.all([builder.watch(), builder.watch()])
  equal(watcherCount, 2, 'each watch() created its own watcher')
  ok(unsubscribed.includes(0), 'first watcher was unsubscribed when second watch() started')
  await h1.close()
  await h2.close()
  ok(unsubscribed.includes(1), 'second watcher was unsubscribed on close')
  await builder.dispose()
})

test('Builder: build() and apply() share the same serialization lock', async () => {
  // Mixed concurrent build()/apply() calls must observe the same mutual
  // exclusion as build()/build(). The `prepare` chokepoint counts overlap,
  // since both code paths run through emitAndWrite → prepare.
  const CWD = '/proj'
  let inflight = 0
  let maxInflight = 0
  let prepareCalls = 0
  const prepare: PrepareHook = async () => {
    inflight++
    maxInflight = Math.max(maxInflight, inflight)
    prepareCalls++
    try {
      await sleep(10)
    } finally {
      inflight--
    }
    return undefined
  }
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } },
    prepare
  }
  const fs = new MemoryFileSystem()
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }]))
  const runtime: TestRuntime = {
    contextStorage: nodeContextStorage,
    fs,
    modules: { load: async () => ({ exports: config, dependencies: [] }) },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  const builder = createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })

  // Interleave build() and apply() with content events. Each apply() seeds
  // a new source file so applyChanges → runIncremental → emitAndWrite runs
  // and prepare is invoked; without the shared lock these would overlap with
  // the in-flight build()s.
  fs.put(join(CWD, 'content/posts/b.json'), JSON.stringify([{ title: 'B' }]))
  fs.put(join(CWD, 'content/posts/c.json'), JSON.stringify([{ title: 'C' }]))
  const tasks = [
    builder.build({ layout: 'single' }),
    builder.apply([{ type: 'add', absPath: join(CWD, 'content/posts/b.json') }]),
    builder.build({ layout: 'single' }),
    builder.apply([{ type: 'add', absPath: join(CWD, 'content/posts/c.json') }]),
    builder.build({ layout: 'single' })
  ]
  const results = await Promise.all(tasks)
  equal(maxInflight, 1, `build/apply overlapped: maxInflight=${maxInflight}`)
  // 3 builds each always invoke prepare; 2 apply(content) each invoke
  // runIncremental → emitAndWrite → prepare. Total = 5.
  equal(prepareCalls, 5, `expected 5 prepare calls (3 build + 2 apply), got ${prepareCalls}`)
  // Each apply() that triggers a content rebuild must return a BuildResult,
  // not undefined — proving it went through the shared lock's emit path.
  for (let i = 1; i <= 3; i += 2) {
    ok(results[i] !== undefined, `apply() at index ${i} should return a BuildResult, got undefined`)
  }
  await builder.dispose()
})
