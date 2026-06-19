import { equal } from 'node:assert'
import { access } from 'node:fs/promises'
import { test } from 'node:test'

import { context, s } from '../../src'
import { runWithContext } from '../../src/runtime/context'

import type { VeliteSchema } from '../../src'

test('exports s as the public schema namespace', async () => {
  const mod = await import('../../src')

  equal('z' in mod, false)
  equal(typeof s.string, 'function')
  equal(typeof s.object, 'function')
  equal(typeof s.markdown, 'function')
})

test('exports a programmatic watch API', async () => {
  const mod = await import('../../src')
  equal(typeof mod.watch, 'function')
})

test('public entry exposes only stable advanced helpers', async () => {
  const mod = await import('../../src')

  equal(typeof mod.getImageMetadata, 'function')
  equal('createAssetStore' in mod, false)
  equal('createLogger' in mod, false)
  equal('isRelativePath' in mod, false)
  equal('logger' in mod, false)
  equal('processAsset' in mod, false)
  equal('rehypeCopyLinkedFiles' in mod, false)
  equal('remarkCopyLinkedFiles' in mod, false)
  equal('VeliteFile' in mod, false)
})

test('public domain modules own their models', async () => {
  const config = await import('../../src/config')
  const collections = await import('../../src/collections')
  const modelsDirExists = await access(new URL('../../src/models', import.meta.url)).then(
    () => true,
    () => false
  )

  equal(typeof config.defineConfig, 'function')
  equal(typeof collections.defineCollection, 'function')
  equal(modelsDirExists, false)
})

test('VeliteSchema accepts an output type parameter', () => {
  const schema: VeliteSchema<string> = s.string()
  equal(schema.parse('hello'), 'hello')
})

test('s.path resolves file path even when input is present', async () => {
  const result = await runWithContext(
    {
      config: { root: '/site/content' } as any,
      file: { path: '/site/content/posts/hello.md' } as any
    },
    () => s.path().safeParseAsync('manual-value')
  )

  equal(result.success, true)
  if (result.success) equal(result.data, 'posts/hello')
})

test('context schemas resolve missing object fields from the current file', async () => {
  const result = await runWithContext(
    {
      config: { root: '/site/content' } as any,
      file: { content: 'Hello from file', path: '/site/content/pages/about.mdx' } as any
    },
    () => s.object({ raw: s.raw() }).safeParseAsync({})
  )

  equal(result.success, true)
  equal((result.data as any).raw, 'Hello from file')
})

test('public parser context exposes stable custom schema fields', async () => {
  const schema = s.string().transform(() => Object.keys(context()).sort())
  const result = await runWithContext(
    {
      config: { root: '/site/content' } as any,
      file: { path: '/site/content/pages/about.mdx' } as any
    },
    () => schema.safeParseAsync('value')
  )

  equal(result.success, true)
  if (result.success) equal(result.data.join(','), 'config,file,store')
})

test('public parser context shares store state within a build session', async () => {
  const key = Symbol('test.store')
  const first = s.string().transform(() => {
    const state = context().store.getOrCreate(key, () => ({ count: 0 }))
    state.count += 1
    return state.count
  })
  const second = s.string().transform(() => {
    const state = context().store.getOrCreate(key, () => ({ count: 0 }))
    state.count += 1
    return state.count
  })

  const result = await runWithContext(
    {
      config: { root: '/site/content' } as any,
      file: { path: '/site/content/pages/about.mdx' } as any
    },
    async () => [await first.parseAsync('one'), await second.parseAsync('two')]
  )

  equal(result.join(','), '1,2')
})

test('parser context helpers are not public entry exports', async () => {
  const mod = await import('../../src')
  equal('parseWithContext' in mod, false)
  equal('runWithContext' in mod, false)
  equal('defineStoreKey' in mod, false)
})
