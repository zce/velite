import { equal } from 'node:assert'
import { test } from 'node:test'

import { context, parseWithContext, s, z } from '../src'

import type { Schema } from '../src'

test('exports zod utilities from the public entry', () => {
  equal(typeof z.string, 'function')
})

test('exports a programmatic watch API', async () => {
  const mod = await import('../src')
  equal(typeof mod.watch, 'function')
})

test('Schema accepts an output type parameter', () => {
  const schema: Schema<string> = z.string()
  equal(schema.parse('hello'), 'hello')
})

test('s.path resolves file path even when input is present', async () => {
  const result = await parseWithContext(s.path(), 'manual-value', {
    config: { root: '/site/content' } as any,
    file: { path: '/site/content/posts/hello.md' } as any
  })

  equal(result.success, true)
  if (result.success) equal(result.data, 'posts/hello')
})

test('context schemas resolve missing object fields from the current file', async () => {
  const result = await parseWithContext(
    s.object({ raw: s.raw() }),
    {},
    {
      config: { root: '/site/content' } as any,
      file: { content: 'Hello from file', path: '/site/content/pages/about.mdx' } as any
    }
  )

  equal(result.success, true)
  equal((result.data as any).raw, 'Hello from file')
})

test('public parser context exposes only stable user-facing fields', async () => {
  const schema = z.string().transform(() => Object.keys(context()).sort())
  const result = await parseWithContext(schema, 'value', {
    config: { root: '/site/content' } as any,
    file: { path: '/site/content/pages/about.mdx' } as any
  })

  equal(result.success, true)
  if (result.success) equal(result.data.join(','), 'config,file')
})
