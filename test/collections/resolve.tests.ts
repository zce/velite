import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { assetStoreKey } from '../../src/assets'
import { createResolver } from '../../src/collections/resolve'
import { createSession } from '../../src/runtime/session'
import { s, z } from '../../src/schemas'

import type { Discoverer } from '../../src/collections/discover'
import type { Config } from '../../src/config'
import type { Loader } from '../../src/loaders/types'
import type { Logger } from '../../src/runtime/logger'

const silentLogger: Logger = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  clear: () => {},
  set: () => {}
}

const jsonLoader: Loader = {
  test: /\.json$/,
  load: file => ({ data: JSON.parse(file.toString()) })
}

const buildConfig = (root: string, collections: Config['collections'], extra: Partial<Config> = {}): Config =>
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
  }) as Config

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
          schema: z.object({ title: z.string() })
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
          schema: z.object({ name: z.string() })
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
          schema: z.object({ title: z.string() })
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
            schema: z.object({ title: z.string() })
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
          schema: z.object({ title: z.string(), file: s.file() })
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
          schema: z.object({ value: z.string() }).transform(({ value }) => (value === 'zero' ? 0 : value === 'false' ? false : ''))
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
