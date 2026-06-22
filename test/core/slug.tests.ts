// Unit tests for the `s.unique` and `s.slug` builtins. These schemas register
// `UniqueEffect`s via `collectEffect` (they do NOT judge conflicts — that's the
// uniqueCheck derivation's job). Tests verify effect registration, slug format
// validation, and reserved-word rejection.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createContentFile, installContextStorage, runWithContext } from '../../src/core/schema/context'
import { s } from '../../src/core/schema/s'
import { nodeContextStorage } from '../../src/runtime/adapters/node'

import type { AssetResult } from '../../src/core/pipeline/asset'
import type { ContentFile, ProjectInfo, SchemaContext } from '../../src/core/schema/context'
import type { UniqueEffect } from '../../src/core/schema/effects'
import type { Schema } from '../../src/core/schema/s'
import type { ContextStorage } from '../../src/runtime/contextual'

installContextStorage(nodeContextStorage as ContextStorage<SchemaContext>)

const project: ProjectInfo = {
  root: '/proj/content',
  configPath: '/proj/velite.config.ts',
  collections: {},
  output: { data: '/proj/.velite', assets: '/proj/public/static', base: '/static/', name: 'static' }
}

const file = (path = '/proj/content/posts/hello.md'): ContentFile => createContentFile('posts/hello.md', path, '')

const stubAsset = async (assetKey: string): Promise<AssetResult> => ({
  publicUrl: `/static/${assetKey}`,
  width: 0,
  height: 0,
  format: '',
  blurDataURL: '',
  blurWidth: 0,
  blurHeight: 0
})

const stubReadFile = async (): Promise<Uint8Array> => new Uint8Array()
const stubProbeImage = async () => ({ width: 0, height: 0, format: '', blurDataURL: '', blurWidth: 0, blurHeight: 0 })

const parseWith = async (schema: Schema, input: unknown, recordId = 'posts/hello.md#') => {
  const effects: UniqueEffect[] = []
  const result = await runWithContext(
    {
      project,
      file: file(),
      record: { id: recordId, index: 0 },
      collectEffect: e => effects.push(e as UniqueEffect),
      asset: stubAsset,
      readFile: stubReadFile,
      probeImage: stubProbeImage
    },
    () => schema.safeParseAsync(input)
  )
  return { result, effects }
}

test('s.unique(): parses a string and registers a UniqueEffect owned by the current record', async () => {
  const { result, effects } = await parseWith(s.unique(), 'hello-world', 'posts/a.md#')
  assert.ok(result.success)
  assert.equal(result.data, 'hello-world')
  assert.equal(effects.length, 1)
  assert.equal(effects[0]!.type, 'unique')
  assert.equal(effects[0]!.owner, 'posts/a.md#')
  assert.equal(effects[0]!.group, 'global')
  assert.equal(effects[0]!.value, 'hello-world')
})

test('s.unique(): accepts a custom group name', async () => {
  const { result, effects } = await parseWith(s.unique('slugs'), 'x')
  assert.ok(result.success)
  assert.equal(effects[0]!.group, 'slugs')
})

test('s.unique(): rejects non-string input', async () => {
  const { result, effects } = await parseWith(s.unique(), 42)
  assert.ok(!result.success)
  assert.equal(effects.length, 0, 'no effect collected on a failed parse')
})

test('s.slug(): parses a valid slug and registers a UniqueEffect under slug:<group>', async () => {
  const { result, effects } = await parseWith(s.slug(), 'hello-world', 'posts/a.md#')
  assert.ok(result.success)
  assert.equal(result.data, 'hello-world')
  assert.equal(effects.length, 1)
  assert.equal(effects[0]!.type, 'unique')
  assert.equal(effects[0]!.group, 'slug:global')
  assert.equal(effects[0]!.value, 'hello-world')
  assert.equal(effects[0]!.owner, 'posts/a.md#')
})

test('s.slug(): accepts a custom group name (prefixed with slug:)', async () => {
  const { result, effects } = await parseWith(s.slug('posts'), 'my-post')
  assert.ok(result.success)
  assert.equal(effects[0]!.group, 'slug:posts')
})

test('s.slug(): rejects a slug shorter than 3 chars', async () => {
  const { result } = await parseWith(s.slug(), 'ab')
  assert.ok(!result.success)
})

test('s.slug(): rejects an invalid slug format', async () => {
  const { result } = await parseWith(s.slug(), 'Hello World!')
  assert.ok(!result.success)
})

test('s.slug(): rejects a reserved slug', async () => {
  const { result } = await parseWith(s.slug('global', ['new', 'edit']), 'new')
  assert.ok(!result.success)
})

test('s.slug(): accepts a non-reserved slug', async () => {
  const { result } = await parseWith(s.slug('global', ['new', 'edit']), 'my-post')
  assert.ok(result.success)
  assert.equal(result.data, 'my-post')
})
