// End-to-end asset tests via the memory-fs: s.image / s.file resolve through
// the two-pass driver, the output JSON carries the content-hashed url + probed
// metadata, the asset file is copied into the assets dir, the no-sharp path
// degrades to zeros, and a missing asset surfaces as a fatal ASSET_FAILED.
import { deepEqual, equal, match, ok, rejects } from 'node:assert/strict'
import { test } from 'node:test'

import { createBuilder, s } from '../src/core'
import { isVeliteError } from '../src/core/diagnostic'
import { join } from '../src/core/util/path'
import { nodeContextStorage, silentLogger } from '../src/runtime/adapters/node'
import { MemoryFileSystem } from './helpers/memory-fs'
import { noopImageProcessor, noopWatch } from './helpers/runtime'

import type { UserConfig } from '../src/core/config'
import type { ImageProcessor } from '../src/runtime/image'
import type { TestRuntime } from './helpers/runtime'

const CWD = '/proj'
const DATA_DIR = join(CWD, '.velite')
const ASSETS_DIR = join(CWD, 'public/static')

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
): { runtime: TestRuntime; fs: MemoryFileSystem } => {
  const fs = new MemoryFileSystem()
  for (const [path, content] of Object.entries(files)) fs.put(path, content)
  const runtime: TestRuntime = {
    contextStorage: nodeContextStorage,
    fs,
    modules: { load: async () => ({ exports: config, dependencies: [] }) },
    logger: silentLogger,
    image: image ?? noopImageProcessor,
    watch: noopWatch
  }
  return { runtime, fs }
}

const build = (runtime: TestRuntime) => createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') }).build({ layout: 'single' })

const readJson = async (fs: MemoryFileSystem, path: string): Promise<unknown> => JSON.parse(new TextDecoder().decode(await fs.read(path)))

test('s.image: resolves a content-relative image to a content-hashed url + probed metadata', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }]),
    [join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))

  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{
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
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }]),
    [join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0)

  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ cover: { src: string } }>
  const src = posts[0]!.cover.src
  const outputName = src.slice('/static/'.length)
  const assetPath = join(ASSETS_DIR, outputName)
  // The asset file was written to the assets dir with the same bytes.
  ok(result.written.includes(assetPath), `expected ${assetPath} in written: ${JSON.stringify(result.written)}`)
  deepEqual(Array.from(await fs.read(assetPath)), Array.from(PNG_BYTES))
})

test('assets: a dropped asset reference is reconciled away on rebuild (no orphan)', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image().optional() }) } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }]),
    [join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })
  const builder = createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })
  const first = await builder.build({ layout: 'single' })
  equal(first.diagnostics.length, 0, JSON.stringify(first.diagnostics))
  const firstAsset = first.written.find(p => p.startsWith(ASSETS_DIR))!
  ok(firstAsset, 'asset written on first build')
  // drop the asset reference and rebuild on the same builder
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{}]))
  const second = await builder.build({ layout: 'single' })
  equal(second.diagnostics.length, 0, JSON.stringify(second.diagnostics))
  await fs.read(firstAsset).then(
    () => ok(false, `orphaned asset should have been removed: ${firstAsset}`),
    () => ok(true, 'orphaned asset removed')
  )
})

test('assets: orphan reconciliation survives across builder instances (persisted manifest)', async () => {
  // Mirrors the public one-shot `build()` path: each call disposes its
  // builder, so cross-build state must come from the persisted manifest.
  const mkConfig = (covered: boolean): { config: UserConfig; entries: unknown[] } => ({
    config: { root: 'content', collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image().optional() }) } } },
    entries: covered ? [{ cover: './cover.png' }] : [{}]
  })
  const fs = new MemoryFileSystem()
  fs.put(join(CWD, 'content/posts/cover.png'), PNG_BYTES)
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify(mkConfig(true).entries))
  const mkBuilder = () => {
    const { config } = mkConfig(true)
    const runtime: TestRuntime = {
      contextStorage: nodeContextStorage,
      fs,
      image: stubImage,
      modules: { load: async () => ({ exports: config, dependencies: [] }) },
      logger: silentLogger,
      watch: noopWatch
    }
    return createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })
  }

  const first = mkBuilder()
  const firstResult = await first.build({ layout: 'single' })
  const firstAsset = firstResult.written.find(p => p.startsWith(ASSETS_DIR))!
  ok(firstAsset, 'asset written on first build')
  await first.dispose()

  // Drop the asset reference, build with a fresh builder.
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify(mkConfig(false).entries))
  const second = mkBuilder()
  const secondResult = await second.build({ layout: 'single' })
  equal(secondResult.diagnostics.length, 0)
  await fs.read(firstAsset).then(
    () => ok(false, `orphaned asset must be reconciled across builders: ${firstAsset}`),
    () => ok(true, 'orphaned asset removed across builders')
  )
  await second.dispose()
})

test('prepare === false reconciles both data and previously written assets', async () => {
  // Same builder, two builds: first writes an asset + data; second returns
  // false from prepare → both the data file AND the asset must be gone.
  let calls = 0
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } },
    prepare: () => {
      calls++
      return calls === 2 ? false : undefined
    }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }]),
    [join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })
  const builder = createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })
  const first = await builder.build({ layout: 'single' })
  const firstAsset = first.written.find(p => p.startsWith(ASSETS_DIR))!
  ok(firstAsset, 'asset written on first build')
  ok(
    first.written.some(p => p.endsWith('posts.json')),
    'data written on first build'
  )

  // Change source so emit (and prepare) re-runs.
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ cover: './cover.png' }, { cover: './cover.png' }]))
  const second = await builder.build({ layout: 'single' })
  equal(second.written.length, 0, 'nothing written when prepare returns false')
  await fs.read(firstAsset).then(
    () => ok(false, `asset should have been reconciled away on prepare=false: ${firstAsset}`),
    () => ok(true, 'asset removed when prepare returns false')
  )
  await fs.read(join(DATA_DIR, 'posts.json')).then(
    () => ok(false, 'posts.json should have been reconciled away on prepare=false'),
    () => ok(true, 'data removed when prepare returns false')
  )
})

test('s.file: resolves a content-relative file to a content-hashed public url', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ doc: s.file() }) } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ doc: './report.pdf' }]),
    [join(CWD, 'content/posts/report.pdf')]: new Uint8Array([0x25, 0x50, 0x44, 0x46])
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0)
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ doc: string }>
  match(posts[0]!.doc, /^\/static\/report-[0-9a-f]{8}\.pdf$/)

  // Non-relative paths pass through unchanged.
  ok(result.written.some(p => p.startsWith(ASSETS_DIR)))
})

test('s.file: full build parses a record once while resolving a content-relative asset', async () => {
  let parseCount = 0
  const config: UserConfig = {
    root: 'content',
    collections: {
      posts: {
        pattern: 'posts/*.json',
        schema: s.object({
          title: s.string().transform(value => {
            parseCount++
            return value
          }),
          doc: s.file()
        })
      }
    }
  }
  const { runtime } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ title: 'A', doc: './report.pdf' }]),
    [join(CWD, 'content/posts/report.pdf')]: new Uint8Array([0x25, 0x50, 0x44, 0x46])
  })

  const result = await build(runtime)

  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  equal(parseCount, 1)
})

test('assets: incremental content-only changes do not recopy unchanged assets', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string(), doc: s.file() }) } }
  }
  const postPath = join(CWD, 'content/posts/a.json')
  const assetPath = join(CWD, 'content/posts/report.pdf')
  const { runtime, fs } = setup(config, {
    [postPath]: JSON.stringify([{ title: 'A', doc: './report.pdf' }]),
    [assetPath]: new Uint8Array([0x25, 0x50, 0x44, 0x46])
  })
  const reads: string[] = []
  const writes: string[] = []
  const countedFs: TestRuntime['fs'] = {
    read: async path => {
      reads.push(path)
      return fs.read(path)
    },
    stat: path => fs.stat(path),
    walk: (root, options) => fs.walk(root, options),
    write: async (path, data) => {
      writes.push(path)
      await fs.write(path, data)
    },
    remove: path => fs.remove(path)
  }
  const builder = createBuilder({ ...runtime, fs: countedFs, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })
  const first = await builder.build({ layout: 'single' })
  equal(first.diagnostics.length, 0, JSON.stringify(first.diagnostics))
  ok(
    first.written.some(path => path.startsWith(ASSETS_DIR)),
    'initial build writes the asset'
  )

  reads.length = 0
  writes.length = 0
  fs.put(postPath, JSON.stringify([{ title: 'A updated', doc: './report.pdf' }]))
  const second = await builder.apply([{ type: 'change', absPath: postPath }])

  ok(second !== undefined, 'content change rebuilds')
  equal(second.diagnostics.length, 0, JSON.stringify(second.diagnostics))
  deepEqual(
    reads.filter(path => path === assetPath),
    [],
    'unchanged asset should not be reread on a content-only rebuild'
  )
  deepEqual(
    writes.filter(path => path.startsWith(ASSETS_DIR)),
    [],
    'unchanged asset should not be rewritten on a content-only rebuild'
  )
})

test('s.file: does not probe non-image assets', async () => {
  let probes = 0
  const image: ImageProcessor = {
    probe: async () => {
      probes++
      return { width: 100, height: 50, format: 'png' }
    },
    blurDataURL: async () => 'data:image/webp;base64,AAA'
  }
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ doc: s.file() }) } }
  }
  const { runtime } = setup(
    config,
    {
      [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ doc: './report.pdf' }]),
      [join(CWD, 'content/posts/report.pdf')]: new Uint8Array([0x25, 0x50, 0x44, 0x46])
    },
    image
  )

  const result = await build(runtime)

  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  equal(probes, 0)
})

test('s.file: non-relative paths pass through unchanged (no asset copy)', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ link: s.file() }) } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ link: 'https://example.com/x.pdf' }])
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0)
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ link: string }>
  equal(posts[0]!.link, 'https://example.com/x.pdf')
  // No asset files written.
  ok(!result.written.some(p => p.startsWith(ASSETS_DIR)))
})

test('s.image: no-sharp degradation — runtime without image processor yields zeros, no crash', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } }
  }
  const { runtime, fs } = setup(
    config,
    {
      [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }]),
      [join(CWD, 'content/posts/cover.png')]: PNG_BYTES
    },
    null
  )

  const result = await build(runtime)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{
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
  const { runtime } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }])
  })

  await rejects(
    build(runtime),
    (err: unknown) => isVeliteError(err) && err.code === 'asset' && err.diagnostics.some(d => d.code === 'ASSET_FAILED' && d.stage === 'asset')
  )
})

test('s.image: a content file shared across two records references one asset, copied once', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }, { cover: './cover.png' }]),
    [join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0)
  // Two records, same asset → one asset file written.
  const assetWrites = result.written.filter(p => p.startsWith(ASSETS_DIR))
  equal(assetWrites.length, 1)
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ cover: { src: string } }>
  equal(posts[0]!.cover.src, posts[1]!.cover.src)
})

test('s.image: strips a cache-busting query string before resolving the source path', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png?v=2' }]),
    [join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ cover: { src: string } }>
  // The query was stripped; the real cover.png was read and content-hashed.
  match(posts[0]!.cover.src, /^\/static\/cover-[0-9a-f]{8}\.png$/)
  equal(posts[0]!.cover.width, 100)
})

test('s.file: strips a cache-busting query string and hash fragment before resolving', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ doc: s.file() }) } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ doc: './report.pdf?v=3#page=1' }]),
    [join(CWD, 'content/posts/report.pdf')]: new Uint8Array([0x25, 0x50, 0x44, 0x46])
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ doc: string }>
  match(posts[0]!.doc, /^\/static\/report-[0-9a-f]{8}\.pdf$/)
})

test('asset write failure (full disk / permissions) surfaces as a fatal ASSET_FAILED diagnostic', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image() }) } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }]),
    [join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })
  // Wrap the fs so writes into the assets dir fail (simulate read-only / full disk).
  const realWrite = fs.write.bind(fs)
  fs.write = async (absPath: string, data: Uint8Array) => {
    if (absPath.startsWith(ASSETS_DIR)) throw new Error('ENOSPC: no space left on device')
    return realWrite(absPath, data)
  }

  await rejects(
    build(runtime),
    (err: unknown) =>
      isVeliteError(err) &&
      err.code === 'asset' &&
      err.diagnostics.some(d => d.code === 'ASSET_FAILED' && d.stage === 'asset' && /failed to write asset/.test(d.message) && d.cause != null)
  )
})

test('s.image: outputName template overrides global output.name and supports subdirectories', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image({ outputName: 'logos/[name]-[hash:6].[ext]' }) }) } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }]),
    [join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ cover: { src: string } }>
  match(posts[0]!.cover.src, /^\/static\/logos\/cover-[0-9a-f]{6}\.png$/)
  // The asset was written under the templated subdirectory.
  ok(
    result.written.some(p => /logos\/cover-[0-9a-f]{6}\.png$/.test(p)),
    JSON.stringify(result.written)
  )
})

test('s.file: outputName template overrides global output.name', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ doc: s.file({ outputName: 'docs/[name].[ext]' }) }) } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ doc: './report.pdf' }]),
    [join(CWD, 'content/posts/report.pdf')]: new Uint8Array([0x25, 0x50, 0x44, 0x46])
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ doc: string }>
  equal(posts[0]!.doc, '/static/docs/report.pdf')
  ok(result.written.some(p => /docs\/report\.pdf$/.test(p)))
})

test('s.image: absoluteRoot reads /-prefixed paths directly, no hash, no copy', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image({ absoluteRoot: join(CWD, 'public') }) }) } }
  }
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: '/logo.png' }]),
    [join(CWD, 'public/logo.png')]: PNG_BYTES
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ cover: { src: string; width: number } }>
  // Public url is verbatim — no /static prefix, no hash.
  equal(posts[0]!.cover.src, '/logo.png')
  equal(posts[0]!.cover.width, 100)
  // No asset copy was emitted.
  ok(!result.written.some(p => p.startsWith(ASSETS_DIR)), JSON.stringify(result.written))
})

test('s.image: blur options propagate to the image processor (custom width)', async () => {
  let receivedOutput: { width?: number; height?: number; quality?: number } | undefined
  const image: ImageProcessor = {
    probe: async () => ({ width: 200, height: 100, format: 'png' }),
    blurDataURL: async (_data, _meta, output) => {
      receivedOutput = output
      return 'data:image/webp;base64,X'
    }
  }
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ cover: s.image({ blur: { width: 32, quality: 80 } }) }) } }
  }
  const { runtime } = setup(
    config,
    {
      [join(CWD, 'content/posts/a.json')]: JSON.stringify([{ cover: './cover.png' }]),
      [join(CWD, 'content/posts/cover.png')]: PNG_BYTES
    },
    image
  )

  await build(runtime)
  equal(receivedOutput?.width, 32)
  equal(receivedOutput?.quality, 80)
})

test('s.markdown: copyLinkedFiles rewrites img src + asset is copied once', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.md', schema: s.object({ html: s.markdown() }) } }
  }
  const md = '# title\n\n![logo](./cover.png)'
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.md')]: md,
    [join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ html: string }>
  match(posts[0]!.html, /<img\s+src="\/static\/cover-[0-9a-f]{8}\.png"/)
  // The asset file was written via the markdown plugin's processAsset hook.
  ok(result.written.some(p => /\/static\/cover-[0-9a-f]{8}\.png$/.test(p)))
})

test('s.markdown: copyLinkedFiles: false leaves urls untouched', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.md', schema: s.object({ html: s.markdown({ copyLinkedFiles: false }) }) } }
  }
  const md = '![logo](./cover.png)'
  const { runtime, fs } = setup(config, {
    [join(CWD, 'content/posts/a.md')]: md,
    [join(CWD, 'content/posts/cover.png')]: PNG_BYTES
  })

  const result = await build(runtime)
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ html: string }>
  match(posts[0]!.html, /<img\s+src="\.\/cover\.png"/)
  ok(!result.written.some(p => p.startsWith(ASSETS_DIR)))
})
