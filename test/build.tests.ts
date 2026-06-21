import { deepEqual, equal, ok, rejects } from 'node:assert'
import { test } from 'node:test'

import { createBuilder, s } from '../src/core'
import { isVeliteError } from '../src/core/diagnostic'
import { posix } from '../src/core/util/path'
import { silentLogger } from '../src/logger'
import { MemoryFileSystem } from './helpers/memory-fs'

import type { UserConfig } from '../src/core/config'
import type { Host } from '../src/core/host'

const CWD = '/proj'
const DATA_DIR = posix.join(CWD, '.velite')

const setup = (config: UserConfig, files: Record<string, string>): { host: Host; fs: MemoryFileSystem } => {
  const fs = new MemoryFileSystem()
  for (const [path, content] of Object.entries(files)) fs.put(path, content)
  const host: Host = {
    fs,
    config: { load: async () => ({ config, dependencies: [] }) },
    path: posix,
    logger: silentLogger
  }
  return { host, fs }
}

const build = (host: Host) => createBuilder(host, { cwd: CWD, configPath: posix.join(CWD, 'velite.config.ts') }).build()

const readJson = async (fs: MemoryFileSystem, path: string): Promise<unknown> => JSON.parse(new TextDecoder().decode(await fs.read(path)))

test('build: list collection (JSON array) and single collection (YAML object)', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: {
      posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) },
      site: { pattern: 'site.yaml', single: true, schema: s.object({ name: s.string() }) }
    }
  }
  const { host, fs } = setup(config, {
    [posix.join(CWD, 'content/posts/a.json')]: JSON.stringify([{ title: 'A' }, { title: 'B' }]),
    [posix.join(CWD, 'content/site.yaml')]: 'name: Site'
  })

  const result = await build(host)
  equal(result.diagnostics.length, 0)
  equal(result.output.collections.posts!.entries.length, 2)
  equal(result.output.collections.site!.mode, 'single')
  equal(result.output.collections.site!.entries.length, 1)

  const posts = await readJson(fs, posix.join(DATA_DIR, 'posts.json'))
  deepEqual(posts, [{ title: 'A' }, { title: 'B' }])
  const site = await readJson(fs, posix.join(DATA_DIR, 'site.json'))
  deepEqual(site, { name: 'Site' })
  ok(result.written.includes(posix.join(DATA_DIR, 'posts.json')))
})

test('build: schema validation errors are non-fatal diagnostics, invalid entries excluded', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } }
  }
  const { host } = setup(config, {
    [posix.join(CWD, 'content/posts/a.json')]: JSON.stringify([{ title: 'A' }, { title: 123 }])
  })

  const result = await build(host)
  ok(result.diagnostics.some(d => d.code === 'SCHEMA_INVALID'))
  equal(result.output.collections.posts!.entries.length, 1) // only the valid entry
})

test('build: fatal (non-schema) errors throw VeliteError and skip output', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { misc: { pattern: 'misc.txt', schema: s.unknown() } }
  }
  const { host, fs } = setup(config, {
    [posix.join(CWD, 'content/misc.txt')]: 'no loader for .txt'
  })

  await rejects(build(host), (err: unknown) => isVeliteError(err) && err.code === 'load')
  // output dir untouched on fatal
  await rejects(readJson(fs, posix.join(DATA_DIR, 'misc.json')))
})

test('build: markdown collection renders body to html via s.markdown()', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: {
      posts: { pattern: 'posts/*.md', schema: s.object({ title: s.string(), body: s.markdown() }) }
    }
  }
  const { host, fs } = setup(config, {
    [posix.join(CWD, 'content/posts/hello.md')]: '---\ntitle: Hello\n---\n# Hello World\n\nA body.'
  })

  const result = await build(host)
  equal(result.diagnostics.length, 0)
  equal(result.output.collections.posts!.entries.length, 1)

  const posts = (await readJson(fs, posix.join(DATA_DIR, 'posts.json'))) as Array<{ title: string; body: string }>
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
  const { host, fs } = setup(config, {
    [posix.join(CWD, 'content/posts/hello.md')]: '---\ntitle: Hello\n---\n# Hello World\n\nA body paragraph here.'
  })

  const result = await build(host)
  equal(result.diagnostics.length, 0)
  const posts = (await readJson(fs, posix.join(DATA_DIR, 'posts.json'))) as Array<{
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
