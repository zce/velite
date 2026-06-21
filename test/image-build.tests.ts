// End-to-end asset tests via the memory-fs: s.image / s.file resolve through
// the two-pass driver, the output JSON carries the content-hashed url + probed
// metadata, the asset file is copied into the assets dir, the no-sharp path
// degrades to zeros, and a missing asset surfaces as a fatal ASSET_FAILED.
import { deepEqual, equal, match, ok, rejects } from 'node:assert/strict'
import { test } from 'node:test'

import { createBuilder, s } from '../src/core'
import { isVeliteError } from '../src/core/diagnostic'
import { posix } from '../src/core/util/path'
import { silentLogger } from '../src/logger'
import { MemoryFileSystem } from './helpers/memory-fs'

import type { UserConfig } from '../src/core/config'
import type { Host } from '../src/core/host'
import type { ImageProcessor } from '../src/core/host/image'

const CWD = '/proj'
const DATA_DIR = posix.join(CWD, '.velite')
const ASSETS_DIR = posix.join(CWD, 'public/static')

// A stub image processor so tests don't need sharp. Returns deterministic dims.
const stubImage: ImageProcessor = {
  probe: async () => ({ width: 100, height: 50, format: 'png' }),
  blurDataURL: async () => 'data:image/webp;base64,AAA'
}

// Fake image bytes — any bytes work because the stub processor ignores them.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

const setup = (
  config: UserConfig,
  files: Record<string, string | Uint8Array>,
  image: ImageProcessor | null = stubImage
): { host: Host; fs: MemoryFileSystem } => {
  const fs = new MemoryFileSystem()
  for (const [path, content] of Object.entries(files)) fs.put(path, content)
  const host: Host = {
    fs,
    config: { load: async () => ({ config, dependencies: [] }) },
    path: posix,
    logger: silentLogger
  }
  if (image !== null) host.image = image
  return { host, fs }
}

const build = (host: Host) => createBuilder(host, { cwd: CWD, configPath: posix.join(CWD, 'velite.config.ts') }).build({ layout: 'single' })

const readJson = async (fs: MemoryFileSystem, path: string): Promise<unknown> => JSON.parse(new TextDecoder().decode(await fs.read(path)))

test('s.image: resolves a content-relative image to a content-hashed url + probed metadata', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } }
  }
  const { host, fs } = setup(config, {
    [posix.join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }]),
    [posix.join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })

  const result = await build(host)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))

  const posts = (await readJson(fs, posix.join(DATA_DIR, 'posts.json'))) as Array<{
    cover: { src: string; width: number; height: number; blurDataURL: string; blurWidth: number; blurHeight: number }
  }>
  equal(posts.length, 1)
  match(posts[0]!.cover.src, /^\/static\/cover-[0-9a-f]{8}\.png$/)
  equal(posts[0]!.cover.width, 100)
  equal(posts[0]!.cover.height, 50)
  equal(posts[0]!.cover.blurDataURL, 'data:image/webp;base64,AAA')
  equal(posts[0]!.cover.blurWidth, 8)
  equal(posts[0]!.cover.blurHeight, 4)
})

test('s.image: the asset file is copied into the assets output directory', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } }
  }
  const { host, fs } = setup(config, {
    [posix.join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }]),
    [posix.join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })

  const result = await build(host)
  equal(result.diagnostics.length, 0)

  const posts = (await readJson(fs, posix.join(DATA_DIR, 'posts.json'))) as Array<{ cover: { src: string } }>
  const src = posts[0]!.cover.src
  const outputName = src.slice('/static/'.length)
  const assetPath = posix.join(ASSETS_DIR, outputName)
  // The asset file was written to the assets dir with the same bytes.
  ok(result.written.includes(assetPath), `expected ${assetPath} in written: ${JSON.stringify(result.written)}`)
  deepEqual(Array.from(await fs.read(assetPath)), Array.from(PNG_BYTES))
})

test('s.file: resolves a content-relative file to a content-hashed public url', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ doc: s.file() }) } }
  }
  const { host, fs } = setup(config, {
    [posix.join(CWD, 'content/posts/a.json')]: JSON.stringify([{ doc: './report.pdf' }]),
    [posix.join(CWD, 'content/posts/report.pdf')]: new Uint8Array([0x25, 0x50, 0x44, 0x46])
  })

  const result = await build(host)
  equal(result.diagnostics.length, 0)
  const posts = (await readJson(fs, posix.join(DATA_DIR, 'posts.json'))) as Array<{ doc: string }>
  match(posts[0]!.doc, /^\/static\/report-[0-9a-f]{8}\.pdf$/)

  // Non-relative paths pass through unchanged.
  ok(result.written.some(p => p.startsWith(ASSETS_DIR)))
})

test('s.file: non-relative paths pass through unchanged (no asset copy)', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ link: s.file() }) } }
  }
  const { host, fs } = setup(config, {
    [posix.join(CWD, 'content/posts/a.json')]: JSON.stringify([{ link: 'https://example.com/x.pdf' }])
  })

  const result = await build(host)
  equal(result.diagnostics.length, 0)
  const posts = (await readJson(fs, posix.join(DATA_DIR, 'posts.json'))) as Array<{ link: string }>
  equal(posts[0]!.link, 'https://example.com/x.pdf')
  // No asset files written.
  ok(!result.written.some(p => p.startsWith(ASSETS_DIR)))
})

test('s.image: no-sharp degradation — host without image processor yields zeros, no crash', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } }
  }
  const { host, fs } = setup(
    config,
    {
      [posix.join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }]),
      [posix.join(CWD, 'content/posts/cover.png')]: PNG_BYTES
    },
    null
  )

  const result = await build(host)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  const posts = (await readJson(fs, posix.join(DATA_DIR, 'posts.json'))) as Array<{
    cover: { src: string; width: number; height: number; blurDataURL: string }
  }>
  // Real content-hashed url, but zero metadata.
  match(posts[0]!.cover.src, /^\/static\/cover-[0-9a-f]{8}\.png$/)
  equal(posts[0]!.cover.width, 0)
  equal(posts[0]!.cover.height, 0)
  equal(posts[0]!.cover.blurDataURL, '')
})

test('s.image: a missing asset file surfaces as a fatal ASSET_FAILED VeliteError', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } }
  }
  // cover.png is referenced but never seeded in the fs.
  const { host } = setup(config, {
    [posix.join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }])
  })

  await rejects(
    build(host),
    (err: unknown) => isVeliteError(err) && err.code === 'asset' && err.diagnostics.some(d => d.code === 'ASSET_FAILED' && d.stage === 'asset')
  )
})

test('s.image: a content file shared across two records references one asset, copied once', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } }
  }
  const { host, fs } = setup(config, {
    [posix.join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }, { cover: './cover.png' }]),
    [posix.join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })

  const result = await build(host)
  equal(result.diagnostics.length, 0)
  // Two records, same asset → one asset file written.
  const assetWrites = result.written.filter(p => p.startsWith(ASSETS_DIR))
  equal(assetWrites.length, 1)
  const posts = (await readJson(fs, posix.join(DATA_DIR, 'posts.json'))) as Array<{ cover: { src: string } }>
  equal(posts[0]!.cover.src, posts[1]!.cover.src)
})

test('s.image: strips a cache-busting query string before resolving the source path', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } }
  }
  const { host, fs } = setup(config, {
    [posix.join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png?v=2' }]),
    [posix.join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })

  const result = await build(host)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  const posts = (await readJson(fs, posix.join(DATA_DIR, 'posts.json'))) as Array<{ cover: { src: string } }>
  // The query was stripped; the real cover.png was read and content-hashed.
  match(posts[0]!.cover.src, /^\/static\/cover-[0-9a-f]{8}\.png$/)
  equal(posts[0]!.cover.width, 100)
})

test('s.file: strips a cache-busting query string and hash fragment before resolving', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ doc: s.file() }) } }
  }
  const { host, fs } = setup(config, {
    [posix.join(CWD, 'content/posts/a.json')]: JSON.stringify([{ doc: './report.pdf?v=3#page=1' }]),
    [posix.join(CWD, 'content/posts/report.pdf')]: new Uint8Array([0x25, 0x50, 0x44, 0x46])
  })

  const result = await build(host)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  const posts = (await readJson(fs, posix.join(DATA_DIR, 'posts.json'))) as Array<{ doc: string }>
  match(posts[0]!.doc, /^\/static\/report-[0-9a-f]{8}\.pdf$/)
})

test('asset write failure (full disk / permissions) surfaces as a fatal ASSET_FAILED diagnostic', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } }
  }
  const { host, fs } = setup(config, {
    [posix.join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }]),
    [posix.join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })
  // Wrap the fs so writes into the assets dir fail (simulate read-only / full disk).
  const realWrite = fs.write.bind(fs)
  fs.write = async (absPath: string, data: Uint8Array) => {
    if (absPath.startsWith(ASSETS_DIR)) throw new Error('ENOSPC: no space left on device')
    return realWrite(absPath, data)
  }

  await rejects(
    build(host),
    (err: unknown) =>
      isVeliteError(err) &&
      err.code === 'asset' &&
      err.diagnostics.some(d => d.code === 'ASSET_FAILED' && d.stage === 'asset' && /failed to write asset/.test(d.message) && d.cause != null)
  )
})
