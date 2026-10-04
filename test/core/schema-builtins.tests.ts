import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isVeliteError } from '../../src/core/diagnostic'
import { content } from '../../src/core/schema/content'
import { context, createContentFile } from '../../src/core/schema/context'
import { s } from '../../src/core/schema/s'
import { runWithContext } from '../helpers/schema-context'

import type { AssetResult } from '../../src/core/pipeline/asset'
import type { ContentFile, ProjectInfo } from '../../src/core/schema/context'
import type { Schema } from '../../src/core/schema/s'

const project: ProjectInfo = {
  root: '/proj/content',
  configPath: '/proj/velite.config.ts',
  collections: {},
  output: { data: '/proj/.velite', assets: '/proj/public/static', base: '/static/', name: 'static' }
}

const file = (fileContent: string, path = '/proj/content/posts/hello.md'): ContentFile => createContentFile('posts/hello.md', path, fileContent)

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

const stubReadFile = async (): Promise<Uint8Array> => new Uint8Array()
const stubProbeImage = async () => ({ width: 0, height: 0, format: '', blurDataURL: '', blurWidth: 0, blurHeight: 0 })

const parseWith = async (schema: Schema, fileContent: string, input: unknown = undefined) =>
  runWithContext(
    {
      project,
      file: file(fileContent),
      record: { id: 'posts/hello.md#', index: 0 },
      collectEffect: () => {},
      asset: stubAsset,
      readFile: stubReadFile,
      probeImage: stubProbeImage
    },
    () => schema.safeParseAsync(input)
  )

test('context(): throws a VeliteError (internal) outside runWithContext', () => {
  assert.throws(
    () => context(),
    (err: unknown) => isVeliteError(err) && err.code === 'internal'
  )
})

test('content.markdown().html(): renders the file body with actual heading anchors', async () => {
  const r = await parseWith(content.markdown().html(), '# Hello\n\nA paragraph.')
  assert.ok(r.success)
  assert.equal(r.data, '<h1 id="hello">Hello</h1>\n<p>A paragraph.</p>')
})

test('content.markdown().html(): uses an explicit field value when provided', async () => {
  const r = await parseWith(content.markdown().html(), 'ignored body', '# Explicit')
  assert.ok(r.success)
  assert.equal(r.data, '<h1 id="explicit">Explicit</h1>')
})

test('content.markdown().html(): issues a custom error when content is empty', async () => {
  const r = await parseWith(content.markdown().html(), '')
  assert.ok(!r.success)
  assert.deepEqual(r.error.issues, [{ code: 'custom', message: 'The content is empty', path: [] }])
})

test('s.raw(): returns the raw file body', async () => {
  const r = await parseWith(s.raw(), 'the raw body')
  assert.ok(r.success)
  assert.equal(r.data, 'the raw body')
})

test('content.markdown().metadata(): computes reading time and word count', async () => {
  const r = await parseWith(content.markdown().metadata(), 'Hello world this is a test of reading time metadata.')
  assert.ok(r.success)
  assert.deepEqual(r.data, { readingTime: 1, wordCount: 10 })
})

test('content.markdown().metadata(): CJK characters contribute without decimal rounding', async () => {
  const r = await parseWith(content.markdown().metadata(), '你好世界这是一段中文内容')
  assert.ok(r.success)
  assert.deepEqual(r.data, { readingTime: 1, wordCount: 12 * 0.56 })
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
      asset: stubAsset,
      readFile: stubReadFile,
      probeImage: stubProbeImage
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
      asset: stubAsset,
      readFile: stubReadFile,
      probeImage: stubProbeImage
    },
    () => s.path({ removeIndex: false }).safeParseAsync(undefined)
  )
  assert.ok(r.success)
  assert.equal(r.data, 'posts/index')
})

test('content.markdown().toc(): returns flat navigation with actual heading IDs', async () => {
  const r = await parseWith(content.markdown().toc(), '# Hello\n\n## Sub')
  assert.ok(r.success)
  assert.deepEqual(r.data, [
    { depth: 1, title: 'Hello', id: 'hello' },
    { depth: 2, title: 'Sub', id: 'sub' }
  ])
})

test('content.markdown().excerpt(): truncates source text to the specified length', async () => {
  const r = await parseWith(content.markdown().excerpt({ length: 10 }), 'one two three four five six seven')
  assert.ok(r.success)
  assert.equal(r.data, 'one two th…')
})

test('s.isoDate(): still works (regression)', async () => {
  const r = await s.isoDate().safeParseAsync('2024-01-15')
  assert.ok(r.success)
  assert.equal(r.data, '2024-01-15T00:00:00.000Z')
})
