import { deepEqual, equal, ok, rejects } from 'node:assert'
import { test } from 'node:test'

import { createBuilder, s } from '../src/core'
import { isVeliteError } from '../src/core/diagnostic'
import { join } from '../src/core/util/path'
import { nodeContextStorage, silentLogger } from '../src/runtime/adapters/node'
import { MemoryFileSystem } from './helpers/memory-fs'
import { createCapturedLogger, noopImageProcessor, noopWatch } from './helpers/runtime'

import type { UserConfig } from '../src/core/config'
import type { TestRuntime } from './helpers/runtime'

const CWD = '/proj'
const DATA_DIR = join(CWD, '.velite')

const setup = (config: UserConfig, files: Record<string, string>): { runtime: TestRuntime; fs: MemoryFileSystem } => {
  const fs = new MemoryFileSystem()
  for (const [path, content] of Object.entries(files)) fs.put(path, content)
  const runtime: TestRuntime = {
    contextStorage: nodeContextStorage,
    fs,
    modules: { load: async () => ({ exports: config, dependencies: [] }) },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  return { runtime, fs }
}

const build = (runtime: TestRuntime, layout: 'split' | 'single' = 'single') =>
  createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') }).build({ layout })

const readJson = async (fs: MemoryFileSystem, path: string): Promise<unknown> => JSON.parse(new TextDecoder().decode(await fs.read(path)))

test('build: list collection (JSON array) and single collection (YAML object)', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: {
      posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) },
      site: { pattern: 'site.yaml', single: true, schema: s.object({ name: s.string() }) }
    }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ title: 'A' }, { title: 'B' }]),
    [join(CWD, 'content/site.yaml')]: 'name: Site'
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0)
  equal(result.output.collections.posts!.entries.length, 2)
  equal(result.output.collections.site!.mode, 'single')
  equal(result.output.collections.site!.entries.length, 1)

  const posts = await readJson(fs, join(DATA_DIR, 'posts.json'))
  deepEqual(posts, [{ title: 'A' }, { title: 'B' }])
  const site = await readJson(fs, join(DATA_DIR, 'site.json'))
  deepEqual(site, { name: 'Site' })
  ok(result.written.includes(join(DATA_DIR, 'posts.json')))
})

test('build: schema validation errors are non-fatal diagnostics, invalid entries excluded', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } }
  }
  const { runtime } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ title: 'A' }, { title: 123 }])
  })

  const result = await build(runtime)
  ok(result.diagnostics.some(d => d.code === 'SCHEMA_INVALID'))
  equal(result.output.collections.posts!.entries.length, 1) // only the valid entry
})

test('build: fatal (non-schema) errors throw VeliteError and skip output', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { misc: { pattern: 'misc.txt', schema: s.unknown() } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/misc.txt')]: 'no loader for .txt'
  })

  await rejects(build(runtime), (err: unknown) => isVeliteError(err) && err.code === 'load')
  // output dir untouched on fatal
  await rejects(readJson(fs, join(DATA_DIR, 'misc.json')))
})

test('build: markdown collection renders body to html via s.markdown()', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: {
      posts: { pattern: 'posts/*.md', schema: s.object({ title: s.string(), body: s.markdown() }) }
    }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/hello.md')]: '---\ntitle: Hello\n---\n# Hello World\n\nA body.'
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0)
  equal(result.output.collections.posts!.entries.length, 1)

  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ title: string; body: string }>
  equal(posts[0]!.title, 'Hello')
  ok(posts[0]!.body.includes('<h1>Hello World</h1>'), posts[0]!.body)
  ok(posts[0]!.body.includes('<p>A body.</p>'), posts[0]!.body)
})

test('build: markdown collection exposes raw body, metadata and path via schemas', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: {
      posts: {
        pattern: 'posts/*.md',
        schema: s.object({ title: s.string(), body: s.raw(), meta: s.metadata(), route: s.path() })
      }
    }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/hello.md')]: '---\ntitle: Hello\n---\n# Hello World\n\nA body paragraph here.'
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0)
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{
    title: string
    body: string
    meta: { readingTime: number; wordCount: number }
    route: string
  }>
  equal(posts[0]!.title, 'Hello')
  equal(posts[0]!.body, '# Hello World\n\nA body paragraph here.')
  ok(posts[0]!.meta.wordCount > 0)
  equal(posts[0]!.route, 'posts/hello')
})

test('build: single layout writes {name}.json + index.js + index.d.ts', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: {
      posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) }
    }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ title: 'A' }])
  })

  const result = await build(runtime, 'single')
  equal(result.diagnostics.length, 0)
  // {name}.json data file
  const posts = await readJson(fs, join(DATA_DIR, 'posts.json'))
  deepEqual(posts, [{ title: 'A' }])
  // entry module + type declaration
  ok(result.written.includes(join(DATA_DIR, 'index.js')))
  ok(result.written.includes(join(DATA_DIR, 'index.d.ts')))
  const entry = new TextDecoder().decode(await fs.read(join(DATA_DIR, 'index.js')))
  ok(entry.includes("export { default as posts } from './posts.json' with { type: 'json' }"))
  const types = new TextDecoder().decode(await fs.read(join(DATA_DIR, 'index.d.ts')))
  ok(types.includes("import type { Infer } from 'velite'"))
  // No split-layout artifacts.
  ok(!result.written.some(p => p.includes('/records/')))
  ok(!result.written.some(p => p.includes('/collections/')))
})

test('build: split layout writes record files + collections/{name}.js + index.js + index.d.ts', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: {
      posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) }
    }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ title: 'A' }, { title: 'B' }])
  })

  const result = await build(runtime, 'split')
  equal(result.diagnostics.length, 0)
  // Two record files under records/posts/
  const recordFiles = result.written.filter(p => p.startsWith(join(DATA_DIR, 'records/posts/')))
  equal(recordFiles.length, 2)
  // collection entry + shared entry + types
  ok(result.written.includes(join(DATA_DIR, 'collections/posts.js')))
  ok(result.written.includes(join(DATA_DIR, 'index.js')))
  ok(result.written.includes(join(DATA_DIR, 'index.d.ts')))
  // No flat {name}.json in split layout.
  ok(!result.written.includes(join(DATA_DIR, 'posts.json')))
  // The collection entry re-exports the record files.
  const entry = new TextDecoder().decode(await fs.read(join(DATA_DIR, 'collections/posts.js')))
  ok(entry.includes("import r0 from '../records/posts/"))
  ok(entry.includes('export default [r0, r1]'))
  // Record file content is the per-record data.
  const recordData = JSON.parse(new TextDecoder().decode(await fs.read(recordFiles[0]!)))
  ok(typeof recordData.title === 'string')
})

test('build: unchanged rebuild skips writes via manifest (single layout)', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } }
  }
  const { runtime } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ title: 'A' }])
  })
  const instance = createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })
  const first = await instance.build({ layout: 'single' })
  ok(first.written.length > 0)
  // A second identical build (same instance → carries the manifest) writes nothing.
  const second = await instance.build({ layout: 'single' })
  deepEqual(second.written, [])
  instance.dispose()
})

test('build: stale output from a previous layout is deleted when switching layouts', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ title: 'A' }])
  })
  const instance = createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })
  // First build: single layout writes posts.json.
  await instance.build({ layout: 'single' })
  ok(await exists(fs, join(DATA_DIR, 'posts.json')))
  // Second build: split layout — posts.json is stale and must be removed.
  await instance.build({ layout: 'split' })
  equal(await exists(fs, join(DATA_DIR, 'posts.json')), false)
  ok(await exists(fs, join(DATA_DIR, 'collections/posts.js')))
  instance.dispose()
})

test('build: logs the essential build lifecycle and output summary', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } }
  }
  const { runtime } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ title: 'A' }])
  })
  const { logger, logs } = createCapturedLogger()
  runtime.logger = logger

  await build(runtime)

  const messages = logs.map(log => log.message)
  ok(messages.some(message => message.includes(`using config '${join(CWD, 'velite.config.ts')}'`)))
  ok(messages.some(message => message.includes(`building from '${join(CWD, 'content')}'`)))
  ok(messages.some(message => message.includes('resolved 1 posts')))
  ok(messages.some(message => message.includes('output 1 data file')))
  ok(messages.some(message => message.includes('build finished')))
})

const exists = async (fs: MemoryFileSystem, path: string): Promise<boolean> =>
  fs.read(path).then(
    () => true,
    () => false
  )
