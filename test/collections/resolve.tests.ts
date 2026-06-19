import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { assetStoreKey } from '../../src/assets'
import { createResolver } from '../../src/collections/resolve'
import { createSession } from '../../src/runtime/session'
import { s } from '../../src/schemas'

import type { Discoverer } from '../../src/collections/discover'
import type { ResolvedConfig } from '../../src/config'
import type { VeliteLoader } from '../../src/loaders/types'
import type { Logger } from '../../src/runtime/logger'

const silentLogger: Logger = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  clear: () => {},
  set: () => {}
}

const jsonLoader: VeliteLoader = {
  test: /\.json$/,
  load: file => ({ data: JSON.parse(file.toString()) })
}

const buildConfig = (root: string, collections: ResolvedConfig['collections'], extra: Partial<ResolvedConfig> = {}): ResolvedConfig =>
  ({
    configPath: join(root, 'velite.config.ts'),
    configImports: [],
    root,
    output: {
      data: join(root, '.velite'),
      assets: join(root, 'public/static'),
      base: '/static/',
      name: '[name]-[hash:8].[ext]',
      clean: false,
      format: 'esm'
    },
    loaders: [jsonLoader],
    strict: false,
    collections,
    ...extra
  }) as ResolvedConfig

describe('Resolver', () => {
  it('resolves a basic collection from discovered paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-resolver-'))
    try {
      await mkdir(join(root, 'content'))
      await writeFile(join(root, 'content', 'a.json'), JSON.stringify({ title: 'A' }))
      await writeFile(join(root, 'content', 'b.json'), JSON.stringify({ title: 'B' }))

      const fakeDiscoverer: Discoverer = {
        async discover() {
          return [join(root, 'content', 'a.json'), join(root, 'content', 'b.json')]
        }
      }

      const collections = {
        items: {
          name: 'Item',
          pattern: 'content/*.json',
          schema: s.object({ title: s.string() })
        }
      }
      const config = buildConfig(root, collections)
      const session = createSession(config, {}, { logger: silentLogger })
      const resolver = createResolver({ discoverer: fakeDiscoverer })

      const { result } = await resolver.resolve(session)
      const items = result.items as { title: string }[]
      deepStrictEqual(items.map(i => i.title).sort(), ['A', 'B'])
      strictEqual(session.resolved.get('items')?.length, 2)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('returns the singleton record when single is true', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-resolver-'))
    try {
      await mkdir(join(root, 'content'))
      await writeFile(join(root, 'content', 'options.json'), JSON.stringify({ name: 'site' }))

      const fakeDiscoverer: Discoverer = {
        async discover() {
          return [join(root, 'content', 'options.json')]
        }
      }

      const config = buildConfig(root, {
        options: {
          name: 'Options',
          single: true,
          pattern: 'content/options.json',
          schema: s.object({ name: s.string() })
        }
      })
      const session = createSession(config, {}, { logger: silentLogger })
      const resolver = createResolver({ discoverer: fakeDiscoverer })

      const { result } = await resolver.resolve(session)
      deepStrictEqual(result.options, { name: 'site' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reports diagnostics without throwing in non-strict mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-resolver-'))
    try {
      await mkdir(join(root, 'content'))
      await writeFile(join(root, 'content', 'bad.json'), JSON.stringify({ title: 123 }))

      const fakeDiscoverer: Discoverer = {
        async discover() {
          return [join(root, 'content', 'bad.json')]
        }
      }

      const config = buildConfig(root, {
        items: {
          name: 'Item',
          pattern: 'content/*.json',
          schema: s.object({ title: s.string() })
        }
      })
      const session = createSession(config, {}, { logger: silentLogger })
      const resolver = createResolver({ discoverer: fakeDiscoverer })
      const { report } = await resolver.resolve(session)
      ok(report.length > 0, 'expected validation report when input is invalid')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('throws in strict mode when validation fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-resolver-'))
    try {
      await mkdir(join(root, 'content'))
      await writeFile(join(root, 'content', 'bad.json'), JSON.stringify({ title: 123 }))

      const fakeDiscoverer: Discoverer = {
        async discover() {
          return [join(root, 'content', 'bad.json')]
        }
      }

      const config = buildConfig(
        root,
        {
          items: {
            name: 'Item',
            pattern: 'content/*.json',
            schema: s.object({ title: s.string() })
          }
        },
        { strict: true }
      )
      const session = createSession(config, {}, { logger: silentLogger })
      const resolver = createResolver({ discoverer: fakeDiscoverer })
      await rejects(resolver.resolve(session), /Schema validation failed/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('threads session.store through s.file()', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-resolver-'))
    try {
      await mkdir(join(root, 'content'))
      await writeFile(join(root, 'content', 'asset.txt'), 'hello')
      await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'A', file: 'asset.txt' }))

      const fakeDiscoverer: Discoverer = {
        async discover() {
          return [join(root, 'content', 'item.json')]
        }
      }

      const config = buildConfig(root, {
        items: {
          name: 'Item',
          pattern: 'content/*.json',
          schema: s.object({ title: s.string(), file: s.file() })
        }
      })
      const session = createSession(config, {}, { logger: silentLogger })
      const resolver = createResolver({ discoverer: fakeDiscoverer })
      await resolver.resolve(session)
      strictEqual(session.store.get(assetStoreKey)?.list().length, 1, 'exactly one asset should be collected')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reuses unaffected collection results during incremental resolve', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-resolver-incremental-'))
    try {
      await mkdir(join(root, 'content'))
      const postsPath = join(root, 'content', 'post.json')
      const tagsPath = join(root, 'content', 'tag.json')
      await writeFile(postsPath, JSON.stringify({ title: 'Post' }))
      await writeFile(tagsPath, JSON.stringify({ title: 'Tag' }))

      const discoverCalls: string[] = []
      const fakeDiscoverer: Discoverer = {
        async discover(_root, pattern) {
          discoverCalls.push(String(pattern))
          return String(pattern).includes('post') ? [postsPath] : [tagsPath]
        }
      }
      const collections = {
        posts: { name: 'Post', pattern: 'content/post.json', schema: s.object({ title: s.string() }) },
        tags: { name: 'Tag', pattern: 'content/tag.json', schema: s.object({ title: s.string() }) }
      }
      const config = buildConfig(root, collections)
      const resolver = createResolver({ discoverer: fakeDiscoverer })
      const session = createSession(config, {}, { logger: silentLogger })

      await resolver.resolve(session)
      discoverCalls.length = 0

      await writeFile(postsPath, JSON.stringify({ title: 'Changed' }))
      session.files.delete(postsPath)
      const { result } = await resolver.resolve(session, { event: 'change', paths: [postsPath] })

      deepStrictEqual(discoverCalls, ['content/post.json'])
      deepStrictEqual(
        (result.posts as { title: string }[]).map(i => i.title),
        ['Changed']
      )
      deepStrictEqual(
        (result.tags as { title: string }[]).map(i => i.title),
        ['Tag']
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('removes unlinked files from affected collection results', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-resolver-unlink-'))
    try {
      await mkdir(join(root, 'content'))
      const a = join(root, 'content', 'a.json')
      const b = join(root, 'content', 'b.json')
      await writeFile(a, JSON.stringify({ title: 'A' }))
      await writeFile(b, JSON.stringify({ title: 'B' }))

      let paths = [a, b]
      const fakeDiscoverer: Discoverer = {
        async discover() {
          return paths
        }
      }
      const config = buildConfig(root, {
        items: { name: 'Item', pattern: 'content/*.json', schema: s.object({ title: s.string() }) }
      })
      const session = createSession(config, {}, { logger: silentLogger })
      const resolver = createResolver({ discoverer: fakeDiscoverer })

      await resolver.resolve(session)
      paths = [a]
      session.files.delete(b)
      const { result } = await resolver.resolve(session, { event: 'unlink', paths: [b] })

      deepStrictEqual(
        (result.items as { title: string }[]).map(i => i.title),
        ['A']
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('preserves falsy parsed results', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-resolver-falsy-'))
    try {
      await mkdir(join(root, 'content'))
      await writeFile(join(root, 'content', 'zero.json'), JSON.stringify({ value: 'zero' }))
      await writeFile(join(root, 'content', 'false.json'), JSON.stringify({ value: 'false' }))
      await writeFile(join(root, 'content', 'empty.json'), JSON.stringify({ value: 'empty' }))

      const files = [join(root, 'content', 'zero.json'), join(root, 'content', 'false.json'), join(root, 'content', 'empty.json')]
      const fakeDiscoverer: Discoverer = {
        async discover() {
          return files
        }
      }

      const config = buildConfig(root, {
        items: {
          name: 'Item',
          pattern: 'content/*.json',
          schema: s.object({ value: s.string() }).transform(({ value }) => (value === 'zero' ? 0 : value === 'false' ? false : ''))
        }
      })
      const session = createSession(config, {}, { logger: silentLogger })
      const resolver = createResolver({ discoverer: fakeDiscoverer })

      const { result } = await resolver.resolve(session)
      deepStrictEqual(result.items, [0, false, ''])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
