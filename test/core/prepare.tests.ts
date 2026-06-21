// Integration tests for the `prepare` hook: void (write original), false (skip
// writes), and a modified result (write the replacement). Uses the full builder
// + MemoryFileSystem so the hook is exercised in its real wiring between emit
// and writeOutput.
import { deepEqual, equal, ok } from 'node:assert/strict'
import { test } from 'node:test'

import { createBuilder, s } from '../../src/core'
import { posix } from '../../src/core/util/path'
import { silentLogger } from '../../src/logger'
import { MemoryFileSystem } from '../helpers/memory-fs'

import type { PrepareContext, PrepareHook, UserConfig } from '../../src/core/config'
import type { Host } from '../../src/core/host'
import type { LogicalOutput } from '../../src/core/output/logical'

const CWD = '/proj'
const DATA_DIR = posix.join(CWD, '.velite')

const baseConfig: UserConfig = {
  root: 'content',
  collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } }
}

const setup = (prepare: PrepareHook | undefined): { host: Host; fs: MemoryFileSystem } => {
  const config: UserConfig = { ...baseConfig, prepare }
  const fs = new MemoryFileSystem()
  fs.put(posix.join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
  const host: Host = { fs, config: { load: async () => ({ config, dependencies: [] }) }, path: posix, logger: silentLogger }
  return { host, fs }
}

const build = (host: Host) => createBuilder(host, { cwd: CWD, configPath: posix.join(CWD, 'velite.config.ts') }).build({ layout: 'single' })

const readJson = async (fs: MemoryFileSystem, path: string): Promise<unknown> => JSON.parse(new TextDecoder().decode(await fs.read(path)))

test('prepare: void return writes the original output', async () => {
  const { host, fs } = setup(() => undefined)
  const result = await build(host)
  ok(
    result.written.some(p => p.endsWith('posts.json')),
    'data file written'
  )
  const posts = (await readJson(fs, posix.join(DATA_DIR, 'posts.json'))) as Array<{ title: string }>
  deepEqual(posts, [{ title: 'A' }, { title: 'B' }])
})

test('prepare: false return suppresses all writes (written: [])', async () => {
  const { host, fs } = setup(() => false)
  const result = await build(host)
  equal(result.written.length, 0, 'nothing written when prepare returns false')
  // The data file was not created.
  await readJson(fs, posix.join(DATA_DIR, 'posts.json')).then(
    () => ok(false, 'posts.json should not exist'),
    () => ok(true, 'posts.json absent as expected')
  )
  // Output is still returned (logical), just not written.
  equal(result.output.collections.posts!.entries.length, 2)
})

test('prepare: a modified result is written in place of the original', async () => {
  const prepare: PrepareHook = result => {
    // Clone the output and tag every post with `processed: true`.
    const output: LogicalOutput = {
      collections: {
        ...result.output.collections,
        posts: {
          ...result.output.collections.posts!,
          entries: result.output.collections.posts!.entries.map(entry => ({
            ...entry,
            data: { ...(entry.data as { title: string }), processed: true }
          }))
        }
      }
    }
    return { output, diagnostics: result.diagnostics }
  }
  const { host, fs } = setup(prepare)
  const result = await build(host)
  ok(result.written.some(p => p.endsWith('posts.json')))
  const posts = (await readJson(fs, posix.join(DATA_DIR, 'posts.json'))) as Array<{ title: string; processed: boolean }>
  equal(posts.length, 2)
  ok(
    posts.every(p => p.processed === true),
    'the modified data was written'
  )
})

test('prepare: receives a context with project metadata and diagnostics', async () => {
  let received: PrepareContext | undefined
  const { host } = setup((_, ctx) => {
    received = ctx
    return undefined
  })
  await build(host)
  ok(received !== undefined)
  ok(received!.project.root.length > 0)
  equal(received!.project.configPath, posix.join(CWD, 'velite.config.ts'))
  equal(received!.project.collections.length, 1)
  equal(received!.project.collections[0]!.name, 'posts')
  ok(Array.isArray(received!.diagnostics))
})

test('prepare: async hook is awaited', async () => {
  const prepare: PrepareHook = async result => {
    await Promise.resolve()
    return { output: result.output, diagnostics: result.diagnostics }
  }
  const { host } = setup(prepare)
  const result = await build(host)
  ok(result.written.some(p => p.endsWith('posts.json')))
})
