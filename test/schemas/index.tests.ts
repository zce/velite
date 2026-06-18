import { equal } from 'node:assert'
import { access } from 'node:fs/promises'
import { test } from 'node:test'

import { context, s, z } from '../../src'
import { runWithContext } from '../../src/runtime/context'

import type { Schema } from '../../src'

test('exports zod utilities from the public entry', () => {
  equal(typeof z.string, 'function')
})

test('exports a programmatic watch API', async () => {
  const mod = await import('../../src')
  equal(typeof mod.watch, 'function')
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

test('Schema accepts an output type parameter', () => {
  const schema: Schema<string> = z.string()
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
  const schema = z.string().transform(() => Object.keys(context()).sort())
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

test('public context store supports custom schema state', async () => {
  const key = Symbol('test.schema.count')
  const schema = z.string().transform(() => {
    const state = context().store.getOrCreate(key, () => ({ value: 0 }))
    state.value += 1
    return state.value
  })

  const first = await runWithContext(
    {
      config: { root: '/site/content' } as any,
      file: { path: '/site/content/pages/about.mdx' } as any
    },
    () => schema.safeParseAsync('value')
  )
  const second = await runWithContext(
    {
      config: { root: '/site/content' } as any,
      file: { path: '/site/content/pages/about.mdx' } as any
    },
    () => schema.safeParseAsync('value')
  )

  equal(first.success, true)
  if (first.success) equal(first.data, 1)
  equal(second.success, true)
  if (second.success) equal(second.data, 1)
})

test('parser context helpers are not public entry exports', async () => {
  const mod = await import('../../src')
  equal('parseWithContext' in mod, false)
  equal('runWithContext' in mod, false)
  equal('defineStoreKey' in mod, false)
})
