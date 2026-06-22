// Integration tests for the `prepare` hook: void (write original), false (skip
// writes), a modified result (write the replacement), and the friendly
// collections view (name → data array / single object, destructurable as the
// first argument). Uses the full builder + MemoryFileSystem so the hook is
// exercised in its real wiring between emit and writeOutput.
import { deepEqual, equal, ok } from 'node:assert/strict'
import { test } from 'node:test'

import { createBuilder, s } from '../../src/core'
import { join } from '../../src/core/util/path'
import { nodeContextStorage, silentLogger } from '../../src/runtime/adapters/node'
import { MemoryFileSystem } from '../helpers/memory-fs'

import type { PrepareCollections, PrepareContext, PrepareHook, UserConfig } from '../../src/core/config'
import type { Runtime } from '../../src/runtime'

const CWD = '/proj'
const DATA_DIR = join(CWD, '.velite')

const baseConfig: UserConfig = {
  root: 'content',
  collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } }
}

const setup = (prepare: PrepareHook | undefined): { runtime: Runtime; fs: MemoryFileSystem } => {
  const config: UserConfig = { ...baseConfig, prepare }
  const fs = new MemoryFileSystem()
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
  const runtime: Runtime = {
    contextStorage: nodeContextStorage,
    fs,
    modules: { load: async () => ({ exports: config, dependencies: [] }) },
    logger: silentLogger
  }
  return { runtime, fs }
}

const build = (runtime: Runtime) => createBuilder(runtime, { cwd: CWD, configPath: join(CWD, 'velite.config.ts') }).build({ layout: 'single' })

const readJson = async (fs: MemoryFileSystem, path: string): Promise<unknown> => JSON.parse(new TextDecoder().decode(await fs.read(path)))

test('prepare: void return writes the original output', async () => {
  const { runtime, fs } = setup(() => undefined)
  const result = await build(runtime)
  ok(
    result.written.some(p => p.endsWith('posts.json')),
    'data file written'
  )
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ title: string }>
  deepEqual(posts, [{ title: 'A' }, { title: 'B' }])
})

test('prepare: false return suppresses all writes (written: [])', async () => {
  const { runtime, fs } = setup(() => false)
  const result = await build(runtime)
  equal(result.written.length, 0, 'nothing written when prepare returns false')
  await readJson(fs, join(DATA_DIR, 'posts.json')).then(
    () => ok(false, 'posts.json should not exist'),
    () => ok(true, 'posts.json absent as expected')
  )
})

test('prepare: collections are destructurable as the first argument', async () => {
  let received: Array<{ title: string }> | undefined
  const prepare: PrepareHook = ({ posts }) => {
    received = posts as Array<{ title: string }>
  }
  const { runtime } = setup(prepare)
  await build(runtime)
  deepEqual(
    received?.map(p => p.title),
    ['A', 'B']
  )
})

test('prepare: mutating the collections view in place (void) writes the mutation', async () => {
  const prepare: PrepareHook = ({ posts }) => {
    for (const post of posts as Array<{ title: string; processed?: boolean }>) post.processed = true
  }
  const { runtime, fs } = setup(prepare)
  const result = await build(runtime)
  ok(result.written.some(p => p.endsWith('posts.json')))
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ title: string; processed: boolean }>
  ok(
    posts.every(p => p.processed === true),
    'in-place mutation propagated'
  )
})

test('prepare: pushing a new entry into the array propagates (rebuild syncs length)', async () => {
  const prepare: PrepareHook = ({ posts }) => {
    ;(posts as Array<{ title: string }>).push({ title: 'C' })
  }
  const { runtime, fs } = setup(prepare)
  await build(runtime)
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ title: string }>
  equal(posts.length, 3)
  equal(posts[2]!.title, 'C')
})

test('prepare: a replaced collections result is written in place of the original', async () => {
  const prepare: PrepareHook = ({ posts }) => {
    const next: PrepareCollections = { posts: (posts as Array<{ title: string }>).map(p => ({ ...p, processed: true })) }
    return { collections: next }
  }
  const { runtime, fs } = setup(prepare)
  const result = await build(runtime)
  ok(result.written.some(p => p.endsWith('posts.json')))
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ title: string; processed: boolean }>
  equal(posts.length, 2)
  ok(
    posts.every(p => p.processed === true),
    'the replaced data was written'
  )
})

test('prepare: single collections expose the single object, not an array', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { options: { pattern: 'options/*.json', single: true, schema: s.object({ name: s.string() }) } }
  }
  let received: unknown
  const fs = new MemoryFileSystem()
  fs.put(join(CWD, 'content/options/a.json'), JSON.stringify({ name: 'velite' }))
  const runtime: Runtime = {
    contextStorage: nodeContextStorage,
    fs,
    modules: {
      load: async () => ({
        exports: {
          ...config,
          prepare: ({ options }: PrepareCollections) => {
            received = options
          }
        },
        dependencies: []
      })
    },
    logger: silentLogger
  }
  await build(runtime)
  deepEqual(received, { name: 'velite' })
})

test('prepare: receives a context with project metadata and diagnostics', async () => {
  let received: PrepareContext | undefined
  const { runtime } = setup((_, ctx) => {
    received = ctx
    return undefined
  })
  await build(runtime)
  ok(received !== undefined)
  ok(received!.project.root.length > 0)
  equal(received!.project.configPath, join(CWD, 'velite.config.ts'))
  equal(received!.project.collections.length, 1)
  equal(received!.project.collections[0]!.name, 'posts')
  ok(Array.isArray(received!.diagnostics))
})

test('prepare: async hook is awaited', async () => {
  const prepare: PrepareHook = async collections => {
    await Promise.resolve()
    return { collections }
  }
  const { runtime } = setup(prepare)
  const result = await build(runtime)
  ok(result.written.some(p => p.endsWith('posts.json')))
})
