// Markdown/MDX dialect-root projection surface.
//
// `s.markdown(options)` and `s.mdx(options)` return roots that ARE the primary
// schema (string -> html / function-body) and ALSO expose three projection
// methods `.toc()`, `.excerpt(options?)`, `.metadata()` that each return an
// independent sibling schema. The top-level `s.toc` / `s.excerpt` /
// `s.metadata` forms are removed.
//
// These tests pin the public API shape. The internals may be transitional
// (direct parse via parseMarkdown/processMdx) until the record-scoped
// derivation module and final projection oracles land.
import { equal, ok, rejects, strictEqual, throws } from 'node:assert/strict'
import { test } from 'node:test'

import { isVeliteError } from '../../src/core/diagnostic'
import { context } from '../../src/core/schema/context'
import { s } from '../../src/core/schema/s'
import { runWithContext } from '../helpers/schema-context'

import type { AssetResult } from '../../src/core/pipeline/asset'
import type { ContentRequest } from '../../src/core/schema/capability'
import type { ContentFile, ProjectInfo } from '../../src/core/schema/context'
import type { Schema } from '../../src/core/schema/s'

const project: ProjectInfo = {
  root: '/proj/content',
  configPath: '/proj/velite.config.ts',
  collections: {},
  output: { data: '/proj/.velite', assets: '/proj/public/static', base: '/static/', name: 'static' }
}

const file = (content: string, path = '/proj/content/posts/hello.md'): ContentFile => ({
  id: 'posts/hello.md',
  path,
  content
})

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

const parseWith = async (schema: Schema, content: string, input: unknown = undefined) =>
  runWithContext(
    {
      project,
      file: file(content),
      record: { id: 'posts/hello.md#', index: 0 },
      collectEffect: () => {},
      asset: stubAsset,
      readFile: stubReadFile,
      probeImage: stubProbeImage
    },
    () => schema.safeParseAsync(input)
  )

test('T2.1: s.markdown() returns a root schema exposing toc/excerpt/metadata methods', () => {
  const root = s.markdown()
  equal(typeof root.toc, 'function', 'root.toc is a function')
  equal(typeof root.excerpt, 'function', 'root.excerpt is a function')
  equal(typeof root.metadata, 'function', 'root.metadata is a function')
  equal(typeof root.safeParseAsync, 'function', 'root is still a Zod schema')
})

test('T2.1: s.mdx() returns a root schema exposing toc/excerpt/metadata methods', () => {
  const root = s.mdx()
  equal(typeof root.toc, 'function', 'root.toc is a function')
  equal(typeof root.excerpt, 'function', 'root.excerpt is a function')
  equal(typeof root.metadata, 'function', 'root.metadata is a function')
  equal(typeof root.safeParseAsync, 'function', 'root is still a Zod schema')
})

test('T2.1: s.markdown().toc() returns a schema (the sibling), not a value', () => {
  const tocSchema = s.markdown().toc()
  equal(typeof tocSchema, 'object')
  equal(typeof (tocSchema as { safeParseAsync?: unknown }).safeParseAsync, 'function', '.toc() returns a Zod schema')
})

test('T2.1: s.markdown().excerpt() returns a schema; .excerpt({ length }) returns a schema', () => {
  const excerptSchema = s.markdown().excerpt()
  equal(typeof (excerptSchema as { safeParseAsync?: unknown }).safeParseAsync, 'function', '.excerpt() returns a Zod schema')
  const excerptWithLength = s.markdown().excerpt({ length: 50 })
  equal(typeof (excerptWithLength as { safeParseAsync?: unknown }).safeParseAsync, 'function', '.excerpt({length}) returns a Zod schema')
})

test('T2.1: s.markdown().metadata() returns a schema', () => {
  const metadataSchema = s.markdown().metadata()
  equal(typeof (metadataSchema as { safeParseAsync?: unknown }).safeParseAsync, 'function', '.metadata() returns a Zod schema')
})

test('T2.1: s.mdx().toc()/excerpt()/metadata() each return a schema', () => {
  const root = s.mdx()
  equal(typeof (root.toc() as { safeParseAsync?: unknown }).safeParseAsync, 'function')
  equal(typeof (root.excerpt() as { safeParseAsync?: unknown }).safeParseAsync, 'function')
  equal(typeof (root.metadata() as { safeParseAsync?: unknown }).safeParseAsync, 'function')
})

test('T2.1: s.markdown().toc() parses to a TocItem[]', async () => {
  const r = await parseWith(s.markdown().toc(), '# Hello\n\n## Sub')
  ok(r.success, 'toc parse should succeed')
  const toc = r.data as { depth: number; title: string; slug: string }[]
  equal(toc.length, 2)
  equal(toc[0]!.depth, 1)
  equal(toc[0]!.title, 'Hello')
  equal(toc[1]!.depth, 2)
  equal(toc[1]!.slug, 'sub')
})

test('T2.1: s.markdown().excerpt() parses to a string', async () => {
  const r = await parseWith(s.markdown().excerpt(), 'one two three four five six seven')
  ok(r.success)
  equal(typeof r.data, 'string')
  ok((r.data as string).length > 0)
})

test('T2.1: s.markdown().excerpt({ length }) truncates per the option', async () => {
  const r = await parseWith(s.markdown().excerpt({ length: 10 }), 'one two three four five six seven')
  ok(r.success)
  const e = r.data as string
  ok(e.length <= 11, `excerpt length ${e.length} should be <= 11`)
})

test('T2.1: s.markdown().metadata() parses to a Metadata object', async () => {
  const r = await parseWith(s.markdown().metadata(), 'Hello world this is a test of reading time metadata.')
  ok(r.success)
  const m = r.data as { readingTime: number; wordCount: number }
  ok(m.wordCount > 0)
  ok(m.readingTime >= 1)
})

test('T2.1: s.mdx().toc()/excerpt()/metadata() parse to the right value types', async () => {
  const tocR = await parseWith(s.mdx().toc(), '# Hello\n\n## Sub')
  ok(tocR.success)
  ok(Array.isArray(tocR.data))

  const excerptR = await parseWith(s.mdx().excerpt(), 'one two three four')
  ok(excerptR.success)
  equal(typeof excerptR.data, 'string')

  const metaR = await parseWith(s.mdx().metadata(), 'Hello world this is a test of reading time metadata.')
  ok(metaR.success)
  const m = metaR.data as { readingTime: number; wordCount: number }
  ok(m.wordCount > 0)
})

test('T2.1: top-level s.toc, s.excerpt, s.metadata are removed from the s namespace', () => {
  equal((s as Record<string, unknown>).toc, undefined, 's.toc must be removed')
  equal((s as Record<string, unknown>).excerpt, undefined, 's.excerpt must be removed')
  equal((s as Record<string, unknown>).metadata, undefined, 's.metadata must be removed')
  ok(!Object.keys(s).includes('toc'), 'toc is not an own key')
  ok(!Object.keys(s).includes('excerpt'), 'excerpt is not an own key')
  ok(!Object.keys(s).includes('metadata'), 'metadata is not an own key')
})

test('T2.1: TocOptions and original are not exported from velite root', async () => {
  const mod = await import('../../src/index')
  ok((mod as Record<string, unknown>).TocOptions === undefined, 'TocOptions must not be exported')
  ok((mod as Record<string, unknown>).original === undefined, 'original must not be exported')
})

test('T2.1: context() outside a schema parse throws VeliteError(internal)', () => {
  throws(
    () => context(),
    (err: unknown) => isVeliteError(err) && err.code === 'internal',
    'context() outside a schema parse throws VeliteError(internal)'
  )
})

test('T2.1: parsing a projection outside a schema parse rejects with VeliteError(internal)', async () => {
  const tocSchema = s.markdown().toc()
  await rejects(
    tocSchema.safeParseAsync(undefined),
    (err: unknown) => isVeliteError(err) && (err as { code?: string }).code === 'internal',
    'projection safeParseAsync outside a schema parse must reject with VeliteError(internal)'
  )
})

test('T2.1: projections are lazy — the content capability is not demanded until the projection is parsed', async () => {
  let contentCalls = 0
  const contentOperation = async (_request: ContentRequest): Promise<unknown> => {
    contentCalls++
    return undefined
  }

  // Constructing the root + projection schemas performs no content capability demand.
  const root = s.markdown()
  const tocSchema = root.toc()
  const excerptSchema = root.excerpt()
  const metadataSchema = root.metadata()
  equal(contentCalls, 0, 'constructing root + projection schemas demands no content')

  // Parsing the TOC projection drives exactly one content capability demand.
  const r = await runWithContext(
    {
      project,
      file: file('# Hello\n\nA paragraph with visible text.'),
      record: { id: 'posts/hello.md#', index: 0 },
      collectEffect: () => {},
      asset: stubAsset,
      readFile: stubReadFile,
      probeImage: stubProbeImage,
      contentOperation
    },
    () => tocSchema.safeParseAsync(undefined)
  )
  ok(r.success)
  equal(contentCalls, 1, 'parsing the toc projection demanded the content capability exactly once')

  // Constructing more projection schemas from the root after the toc parse
  // does not retroactively demand the content capability.
  const beforeMore = contentCalls
  const unusedExcerpt = root.excerpt({ length: 5 })
  const unusedMeta = root.metadata()
  equal(contentCalls, beforeMore, 'constructing other projection schemas does not demand content')
  void excerptSchema
  void metadataSchema
  void unusedExcerpt
  void unusedMeta
})

test('T2.1: the projection method on the root carries no per-record state across records', () => {
  const root1 = s.markdown()
  const root2 = s.markdown()
  ok(typeof root1.toc === 'function')
  ok(typeof root2.toc === 'function')
  ok(root1 !== root2, 'distinct root constructions are distinct schema instances')
})

test('T2.1: s.markdown().excerpt({ length: 0 }) is a valid schema (zero is accepted at construction)', () => {
  const schema = s.markdown().excerpt({ length: 0 })
  ok(typeof (schema as { safeParseAsync?: unknown }).safeParseAsync === 'function')
})

test('T2.1: reusing one root for primary + projections is supported', async () => {
  const content = s.markdown()
  const objSchema = s.object({
    content,
    toc: content.toc(),
    excerpt: content.excerpt(),
    metadata: content.metadata()
  })
  const r = await runWithContext(
    {
      project,
      file: file('# Title\n\nBody text with some words for reading time.'),
      record: { id: 'posts/hello.md#', index: 0 },
      collectEffect: () => {},
      asset: stubAsset,
      readFile: stubReadFile,
      probeImage: stubProbeImage
    },
    () => objSchema.safeParseAsync({ content: '# Title\n\nBody text with some words for reading time.' })
  )
  ok(r.success, 'object schema with root + projections should parse')
  if (r.success) {
    const data = r.data as { content: string; toc: unknown[]; excerpt: string; metadata: { readingTime: number; wordCount: number } }
    ok(typeof data.content === 'string')
    ok(Array.isArray(data.toc))
    equal(typeof data.excerpt, 'string')
    ok(data.metadata.wordCount > 0)
  }
})

test('T2.1: projection-only use is supported (root.toc() without primary)', async () => {
  const r = await parseWith(s.markdown().toc(), '# Hello\n\n## Sub')
  ok(r.success)
  ok(Array.isArray(r.data))
  strictEqual((r.data as unknown[]).length, 2)
})
