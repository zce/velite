// Watch resilience: a rebuild that ends in a thrown error (e.g. content that
// fails to load) must not surface as an unhandled rejection from the
// scheduler's fire-and-forget drain. The builder's scheduler wiring catches
// the failure, logs it, and keeps the watcher alive — the next event after
// the fix must produce a clean rebuild.
import { equal, ok } from 'node:assert/strict'
import { test } from 'node:test'

import { s } from '../src/core'
import { createBuilder } from '../src/core/builder'
import { join } from '../src/core/util/path'
import { MemoryFileSystem } from './helpers/memory-fs'
import { createCapturedLogger, noopImageProcessor, testContentExecutionsFactory, testSchemaRunner } from './helpers/runtime'

import type { BuildResult } from '../src/core'
import type { UserConfig } from '../src/core/config'
import type { FileEvent, Watcher } from '../src/runtime/watcher'
import type { TestRuntime } from './helpers/runtime'

const CWD = '/proj'
const ROOT = join(CWD, 'content')

const config: UserConfig = {
  root: 'content',
  collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } }
}

const postPath = join(ROOT, 'posts/a.json')
const validBody = JSON.stringify([{ title: 'A' }])

/** Resolve once `condition` holds; rejects after `timeoutMs` so a hung test fails loudly. */
const until = async (condition: () => boolean, timeoutMs = 5000): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for condition')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

test('watch: a failed rebuild is logged and the watcher keeps rebuilding', async () => {
  const fs = new MemoryFileSystem()
  fs.put(postPath, validBody)
  let push: ((event: FileEvent) => void) | undefined
  const watch = (): Watcher => ({
    subscribe: fn => {
      push = fn
      return () => {}
    },
    add: () => {}
  })
  const { logger, logs } = createCapturedLogger()
  const runtime: TestRuntime = {
    schemaRunner: testSchemaRunner(),
    contentExecutionsFactory: testContentExecutionsFactory(),
    fs,
    modules: { load: async () => ({ exports: config, dependencies: [] }) },
    logger,
    image: noopImageProcessor,
    watch
  }

  const builder = createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })
  let rebuilt: ((result: BuildResult) => void) | undefined
  const handle = await builder.watch(
    {
      debounceMs: 0,
      onRebuild: result => rebuilt?.(result)
    },
    { layout: 'single' }
  )
  ok(push !== undefined, 'watcher subscribed')

  // Break the file: the loader failure is a fatal (load-stage) diagnostic, so
  // the rebuild throws. Before the fix this rejection escaped the scheduler
  // as an unhandled rejection and killed the process.
  fs.put(postPath, '{ broken json')
  push({ type: 'change', absPath: postPath })
  await until(() => logs.some(log => log.level === 'error'))
  ok(
    logs.some(log => log.level === 'error' && log.message.includes('broken json') === false),
    'the rebuild failure is logged as an error'
  )

  // The watcher is still alive: fix the file and the next event rebuilds.
  const nextResult = new Promise<BuildResult>(resolve => {
    rebuilt = resolve
  })
  fs.put(postPath, validBody)
  push({ type: 'change', absPath: postPath })
  const result = await nextResult
  equal(result.diagnostics.length, 0, 'rebuild after the fix is clean')

  await handle.close()
  await builder.dispose()
})
