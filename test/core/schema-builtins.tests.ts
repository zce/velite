import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isVeliteError } from '../../src/core/diagnostic'
import { context, createContentFile, runWithContext } from '../../src/core/schema/context'
import { s } from '../../src/core/schema/s'

import type { AssetResult } from '../../src/core/pipeline/asset'
import type { ContentFile, ProjectInfo } from '../../src/core/schema/context'
import type { Schema } from '../../src/core/schema/s'

const project: ProjectInfo = {
  root: '/proj/content',
  configPath: '/proj/velite.config.ts',
  collections: {},
  output: { data: '/proj/.velite', assets: '/proj/public/static', base: '/static/', name: 'static' }
}

const file = (content: string, path = '/proj/content/posts/hello.md'): ContentFile => createContentFile('posts/hello.md', path, content)

// A stand-in asset closure for unit tests that don't exercise the asset pipeline.
const stubAsset = async (assetKey: string): Promise<AssetResult> => ({
  publicUrl: `/static/${assetKey}`,
  width: 0,
  height: 0,
  format: '',
  blurDataURL: '',
  blurWidth: 0,
  blurHeight: 0
})

const parseWith = async (schema: Schema, content: string, input: unknown = undefined) =>
  runWithContext({ project, file: file(content), record: { id: 'posts/hello.md#', index: 0 }, collectEffect: () => {}, asset: stubAsset }, () =>
    schema.safeParseAsync(input)
  )

test('context(): throws a VeliteError (internal) outside runWithContext', () => {
  assert.throws(
    () => context(),
    (err: unknown) => isVeliteError(err) && err.code === 'internal'
  )
})

test('s.markdown(): renders the file body to html', async () => {
  const r = await parseWith(s.markdown(), '# Hello\n\nA paragraph.')
  assert.ok(r.success)
  assert.ok((r.data as string).includes('<h1>Hello</h1>'))
  assert.ok((r.data as string).includes('<p>A paragraph.</p>'))
})

test('s.markdown(): uses an explicit field value when provided', async () => {
  const r = await parseWith(s.markdown(), 'ignored body', '# Explicit')
  assert.ok(r.success)
  assert.ok((r.data as string).includes('<h1>Explicit</h1>'))
})

test('s.markdown(): issues a custom error when content is empty', async () => {
  const r = await parseWith(s.markdown(), '')
  assert.ok(!r.success)
})

test('s.raw(): returns the raw file body', async () => {
  const r = await parseWith(s.raw(), 'the raw body')
  assert.ok(r.success)
  assert.equal(r.data, 'the raw body')
})

test('s.metadata(): computes reading time and word count', async () => {
  const r = await parseWith(s.metadata(), 'Hello world this is a test of reading time metadata.')
  assert.ok(r.success)
  const m = r.data as { readingTime: number; wordCount: number }
  assert.ok(m.wordCount > 0)
  assert.ok(m.readingTime >= 1)
})

test('s.metadata(): CJK characters count towards word count', async () => {
  const r = await parseWith(s.metadata(), '你好世界这是一段中文内容')
  assert.ok(r.success)
  const m = r.data as { readingTime: number; wordCount: number }
  assert.ok(m.wordCount > 0, 'CJK chars should contribute to word count')
})

test('s.path(): flattens the file path relative to the project root', async () => {
  const r = await parseWith(s.path(), 'body')
  assert.ok(r.success)
  assert.equal(r.data, 'posts/hello')
})

test('s.path(): removes a trailing /index segment by default', async () => {
  const r = await runWithContext(
    {
      project,
      file: createContentFile('posts/index.md', '/proj/content/posts/index.md', 'body'),
      record: { id: 'posts/index.md#', index: 0 },
      collectEffect: () => {},
      asset: stubAsset
    },
    () => s.path().safeParseAsync(undefined)
  )
  assert.ok(r.success)
  assert.equal(r.data, 'posts')
})

test('s.path(): keeps /index when removeIndex is false', async () => {
  const r = await runWithContext(
    {
      project,
      file: createContentFile('posts/index.md', '/proj/content/posts/index.md', 'body'),
      record: { id: 'posts/index.md#', index: 0 },
      collectEffect: () => {},
      asset: stubAsset
    },
    () => s.path({ removeIndex: false }).safeParseAsync(undefined)
  )
  assert.ok(r.success)
  assert.equal(r.data, 'posts/index')
})

test('s.toc(): extracts a flat heading toc', async () => {
  const r = await parseWith(s.toc(), '# Hello\n\n## Sub')
  assert.ok(r.success)
  const toc = r.data as { depth: number; title: string; slug: string }[]
  assert.equal(toc.length, 2)
  assert.equal(toc[0]!.depth, 1)
  assert.equal(toc[1]!.slug, 'sub')
})

test('s.excerpt(): extracts a plain-text excerpt of the given length', async () => {
  const r = await parseWith(s.excerpt({ length: 10 }), 'one two three four five six seven')
  assert.ok(r.success)
  const e = r.data as string
  assert.ok(e.length <= 11)
})

test('s.isodate(): still works (regression)', async () => {
  const r = await s.isodate().safeParseAsync('2024-01-15')
  assert.ok(r.success)
  assert.equal(r.data, '2024-01-15T00:00:00.000Z')
})
