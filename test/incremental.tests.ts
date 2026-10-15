import { deepEqual, equal, ok } from 'node:assert'
import { test } from 'node:test'

import { s } from '../src/core'
import { createBuilder } from '../src/core/builder'
import { join } from '../src/core/util/path'
import { silentLogger } from '../src/runtime/adapters/node'
import { MemoryFileSystem } from './helpers/memory-fs'
import { noopImageProcessor, noopWatch, testContentExecutionsFactory, testSchemaRunner } from './helpers/runtime'

import type { UserConfig } from '../src/core/config'
import type { FileEvent } from '../src/runtime/watcher'
import type { TestRuntime } from './helpers/runtime'

const CWD = '/proj'
const ROOT = join(CWD, 'content')

const config: UserConfig = {
  root: 'content',
  collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } }
}

const file = (name: string, data: unknown): string => join(ROOT, `posts/${name}.json`)
const body = (items: Array<{ title: string }>): string => JSON.stringify(items)

const setup = (): { runtime: TestRuntime; fs: MemoryFileSystem } => {
  const fs = new MemoryFileSystem()
  fs.put(file('a'), body([{ title: 'A' }]))
  fs.put(file('b'), body([{ title: 'B' }]))
  fs.put(file('c'), body([{ title: 'C' }]))
  const runtime: TestRuntime = {
    schemaRunner: testSchemaRunner(),
    contentExecutionsFactory: testContentExecutionsFactory(),
    fs,
    modules: { load: async () => ({ exports: config, dependencies: [] }) },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  return { runtime, fs }
}

const newBuilder = (runtime: TestRuntime) => createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })

const entries = (result: { output: { collections: Record<string, { entries: Array<{ data: unknown }> }> } }): unknown[] =>
  result.output.collections.posts!.entries.map(e => e.data)

const diagSummary = (result: { diagnostics: Array<{ code: string; file?: string }> }): string[] =>
  result.diagnostics
    .map(
      d =>
        `${d.code}:${d.provenance.scope === 'source' ? (d.provenance as { source: { path: string } }).source.path : d.provenance.scope === 'record' ? (d.provenance as { source: { path: string } }).source.path : ''}`
    )
    .sort()

test('incremental ≡ full: modify/add/delete produce the same output as a clean full build', async () => {
  const { runtime, fs } = setup()
  const builder = newBuilder(runtime)

  // Baseline full build.
  await builder.build({ layout: 'single' })

  // Mutate the filesystem: change `a`, delete `c`, add `d`.
  fs.put(file('a'), body([{ title: 'A2' }]))
  fs.remove(file('c'))
  fs.put(file('d'), body([{ title: 'D' }]))

  const events: FileEvent[] = [
    { type: 'change', absPath: file('a') },
    { type: 'unlink', absPath: file('c') },
    { type: 'add', absPath: file('d') }
  ]
  const incremental = await builder.apply(events)
  ok(incremental !== undefined, 'apply should rebuild on content events')

  // Clean full build against the same final filesystem state.
  const clean = await newBuilder(runtime).build({ layout: 'single' })

  deepEqual(entries(incremental!), entries(clean), 'incremental entries must equal clean full build entries')
  deepEqual(diagSummary(incremental!), diagSummary(clean), 'diagnostic categories must match')
})

test('incremental patches survive prior schema errors: carry for unchanged sources, drop for re-validated ones', async () => {
  const { runtime, fs } = setup()
  // `bad` fails schema validation — a non-fatal schema-stage error that is
  // reported on the build result and remembered by the emitter.
  fs.put(file('bad'), JSON.stringify([{ nope: true }]))
  const builder = newBuilder(runtime)
  const first = await builder.build({ layout: 'single' })
  equal(first.diagnostics.filter(d => d.level === 'error').length, 1, 'schema error is non-fatal but reported')

  // Changing an unrelated valid file must still patch incrementally (the
  // remembered error must not disable patching) and carry `bad`'s error.
  fs.put(file('a'), body([{ title: 'A2' }]))
  const second = await builder.apply([{ type: 'change', absPath: file('a') }])
  ok(second !== undefined, 'apply rebuilt')
  const carried = second!.diagnostics.filter(d => d.level === 'error')
  equal(carried.length, 1, "the unrelated source's schema error is carried into the patch result")
  ok(carried[0]!.provenance.scope === 'record', 'carried error keeps its record provenance')
  deepEqual(entries(second!), [{ title: 'A2' }, { title: 'B' }, { title: 'C' }], 'invalid entry stays excluded')

  // Fixing `bad` re-validates it: its old error must be dropped, the entry included.
  fs.put(file('bad'), body([{ title: 'Fixed' }]))
  const third = await builder.apply([{ type: 'change', absPath: file('bad') }])
  ok(third !== undefined, 'apply rebuilt')
  equal(third!.diagnostics.length, 0, "the re-validated source's error is dropped")
  // Entry order is by entry id, so `bad.json` sorts before `c.json`.
  deepEqual(entries(third!), [{ title: 'A2' }, { title: 'B' }, { title: 'Fixed' }, { title: 'C' }])
})

test('incremental ≡ full: rename (unlink + add) keeps output stable', async () => {
  const { runtime, fs } = setup()
  const builder = newBuilder(runtime)
  await builder.build({ layout: 'single' })

  // Rename b -> e: delete b, add e with b's content.
  fs.remove(file('b'))
  fs.put(file('e'), body([{ title: 'B' }]))
  const incremental = await builder.apply([
    { type: 'unlink', absPath: file('b') },
    { type: 'add', absPath: file('e') }
  ])

  const clean = await newBuilder(runtime).build({ layout: 'single' })
  deepEqual(entries(incremental!), entries(clean))
  equal(incremental!.diagnostics.length, clean.diagnostics.length)
})

test('incremental: no-op events return undefined (no rebuild)', async () => {
  const { runtime } = setup()
  const builder = newBuilder(runtime)
  await builder.build({ layout: 'single' })

  // An event outside the content root and not the config path is classified 'ignore'.
  const result = await builder.apply([{ type: 'add', absPath: join(CWD, 'elsewhere.txt') }])
  equal(result, undefined, 'ignored events should not trigger a rebuild')
})
