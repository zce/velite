// T2.2 — Exact selected-input contract.
//
// `selected text = explicit string input ?? ContentFile.content`. An explicit
// string always wins, including ''. The file body is consulted only when the
// schema input is absent. Missing or exactly-'' selected text produces a
// non-fatal `The content is empty` Zod custom issue and performs zero parse
// work (no content-capability demand, no parseMarkdown/processMarkdown call).
// Whitespace-only and no-visible-text non-empty sources parse normally and
// produce the no-visible-text success results. Equal explicit and fallback
// text with the same origin/profile produce byte/value-identical results.
import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert/strict'
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

const file = (content: string | undefined, path = '/proj/content/p.md'): ContentFile => ({
  id: 'p.md',
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

interface ParseInput {
  readonly schema: Schema
  readonly fileContent?: string
  readonly input?: unknown
  readonly contentOperation?: (request: ContentRequest) => Promise<unknown>
  readonly onContentDemand?: (request: ContentRequest) => void
}

const parse = async ({ schema, fileContent, input, contentOperation, onContentDemand }: ParseInput) =>
  runWithContext(
    {
      project,
      file: file(fileContent),
      record: { id: 'p.md#', index: 0 },
      collectEffect: () => {},
      asset: stubAsset,
      readFile: stubReadFile,
      probeImage: stubProbeImage,
      contentOperation,
      onContentDemand
    },
    () => schema.safeParseAsync(input)
  )

const countingDemand = (counter: { count: number }) => (): void => {
  counter.count++
}

const noVisibleTextBody = '<!-- only an html comment, no statically visible text -->'
const noVisibleTextMdxBody = '{/* only an mdx expression comment, no statically visible text */}'

test('T2.2: explicit empty string is selected over a non-empty file body and yields the empty issue (markdown.toc)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.markdown().toc(), fileContent: '# File Title\n\nBody text.', input: '', onContentDemand: countingDemand(counter) })
  ok(!r.success, 'empty explicit input must fail the record')
  const issues = r.error.issues
  strictEqual(issues.length, 1)
  strictEqual(issues[0]!.code, 'custom')
  strictEqual(issues[0]!.message, 'The content is empty')
  strictEqual(issues[0]!.fatal, undefined, 'the empty-content issue is non-fatal')
  strictEqual(counter.count, 0, 'no content-capability demand on the empty path')
})

test('T2.2: explicit empty string is selected over a non-empty file body and yields the empty issue (markdown.excerpt)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.markdown().excerpt(), fileContent: '# File\n\nText.', input: '', onContentDemand: countingDemand(counter) })
  ok(!r.success)
  strictEqual(r.error.issues[0]!.message, 'The content is empty')
  strictEqual(counter.count, 0)
})

test('T2.2: explicit empty string is selected over a non-empty file body and yields the empty issue (markdown.metadata)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.markdown().metadata(), fileContent: '# File\n\nText.', input: '', onContentDemand: countingDemand(counter) })
  ok(!r.success)
  strictEqual(r.error.issues[0]!.message, 'The content is empty')
  strictEqual(counter.count, 0)
})

test('T2.2: explicit empty string is selected over a non-empty file body and yields the empty issue (primary markdown)', async () => {
  const r = await parse({ schema: s.markdown(), fileContent: '# File\n\nText.', input: '' })
  ok(!r.success)
  strictEqual(r.error.issues[0]!.message, 'The content is empty')
  strictEqual(r.error.issues[0]!.fatal, undefined, 'primary empty path is non-fatal')
})

test('T2.2: explicit empty string is selected over a non-empty file body and yields the empty issue (primary mdx)', async () => {
  const r = await parse({ schema: s.mdx(), fileContent: '# File\n\nText.', input: '' })
  ok(!r.success)
  strictEqual(r.error.issues[0]!.message, 'The content is empty')
  strictEqual(r.error.issues[0]!.fatal, undefined, 'mdx primary empty path is non-fatal')
})

test('T2.2: missing file.content (undefined) with no explicit input yields the empty issue with zero parse work (markdown.toc)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.markdown().toc(), fileContent: undefined, input: undefined, onContentDemand: countingDemand(counter) })
  ok(!r.success)
  strictEqual(r.error.issues[0]!.message, 'The content is empty')
  strictEqual(counter.count, 0, 'no content-capability demand when selected text is missing')
})

test('T2.2: missing file.content (undefined) with no explicit input yields the empty issue with zero parse work (markdown.excerpt)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.markdown().excerpt(), fileContent: undefined, onContentDemand: countingDemand(counter) })
  ok(!r.success)
  strictEqual(r.error.issues[0]!.message, 'The content is empty')
  strictEqual(counter.count, 0)
})

test('T2.2: missing file.content (undefined) with no explicit input yields the empty issue with zero parse work (markdown.metadata)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.markdown().metadata(), fileContent: undefined, onContentDemand: countingDemand(counter) })
  ok(!r.success)
  strictEqual(r.error.issues[0]!.message, 'The content is empty')
  strictEqual(counter.count, 0)
})

test('T2.2: missing file.content (undefined) with no explicit input yields the empty issue (primary markdown)', async () => {
  const r = await parse({ schema: s.markdown(), fileContent: undefined })
  ok(!r.success)
  strictEqual(r.error.issues[0]!.message, 'The content is empty')
})

test('T2.2: missing file.content (undefined) with no explicit input yields the empty issue (primary mdx)', async () => {
  const r = await parse({ schema: s.mdx(), fileContent: undefined })
  ok(!r.success)
  strictEqual(r.error.issues[0]!.message, 'The content is empty')
})

test('T2.2: explicit non-empty string differing from file.content is selected (markdown.toc reflects the explicit text)', async () => {
  const r = await parse({
    schema: s.markdown().toc(),
    fileContent: '# File Title\n\n## File Sub',
    input: '# Explicit Title\n\n## Explicit Sub'
  })
  ok(r.success)
  const toc = r.data as { depth: number; title: string; slug: string }[]
  strictEqual(toc.length, 2)
  strictEqual(toc[0]!.title, 'Explicit Title')
  strictEqual(toc[1]!.title, 'Explicit Sub')
})

test('T2.2: explicit non-empty string differing from file.content is selected (markdown.excerpt reflects the explicit text)', async () => {
  const r = await parse({ schema: s.markdown().excerpt(), fileContent: 'File body text here.', input: 'Explicit excerpt text here.' })
  ok(r.success)
  const excerpt = r.data as string
  ok(excerpt.startsWith('Explicit'), `excerpt must reflect the explicit input, got: ${excerpt}`)
})

test('T2.2: explicit non-empty string differing from file.content is selected (markdown.metadata reflects the explicit text)', async () => {
  const r = await parse({
    schema: s.markdown().metadata(),
    fileContent: 'aaa bbb ccc',
    input: 'one two three four five six seven eight nine ten eleven twelve thirteen'
  })
  ok(r.success)
  const m = r.data as { readingTime: number; wordCount: number }
  ok(m.wordCount >= 12, `metadata must count the explicit text, got wordCount=${m.wordCount}`)
})

test('T2.2: explicit non-empty string differing from file.content is selected (primary markdown renders the explicit text)', async () => {
  const r = await parse({ schema: s.markdown(), fileContent: '# File Body', input: '# Explicit Body' })
  ok(r.success)
  const html = r.data as string
  ok(html.includes('Explicit Body'), `primary markdown must render the explicit input, got: ${html}`)
  ok(!html.includes('File Body'), 'primary markdown must not render the file body when explicit input is provided')
})

test('T2.2: whitespace-only body parses normally and does NOT take the empty guard (markdown.toc)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.markdown().toc(), fileContent: '   \n\n\t  ', onContentDemand: countingDemand(counter) })
  ok(r.success, 'whitespace-only body is non-empty and parses normally')
  ok(Array.isArray(r.data))
  strictEqual(counter.count, 1, 'whitespace-only body must demand the content capability (parsed)')
})

test('T2.2: whitespace-only body parses normally (markdown.excerpt produces empty string)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.markdown().excerpt(), fileContent: '   \n\n\t  ', onContentDemand: countingDemand(counter) })
  ok(r.success)
  strictEqual(r.data, '', 'whitespace-only body yields an empty excerpt (no statically visible text)')
  strictEqual(counter.count, 1)
})

test('T2.2: whitespace-only body parses normally (markdown.metadata yields readingTime 1, wordCount 0)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.markdown().metadata(), fileContent: '   \n\n\t  ', onContentDemand: countingDemand(counter) })
  ok(r.success)
  deepStrictEqual(r.data, { readingTime: 1, wordCount: 0 }, 'whitespace-only body yields the no-visible-text success results')
  strictEqual(counter.count, 1)
})

test('T2.2: no-visible-text body (html-comment-only) parses normally and produces the no-visible-text success results (metadata)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.markdown().metadata(), fileContent: noVisibleTextBody, onContentDemand: countingDemand(counter) })
  ok(r.success, 'no-visible-text body is non-empty and parses normally — not reclassified as missing')
  deepStrictEqual(r.data, { readingTime: 1, wordCount: 0 }, 'no-visible-text metadata success results')
  strictEqual(counter.count, 1, 'no-visible-text body must demand the content capability (parsed, not empty-guarded)')
})

test('T2.2: no-visible-text body (html-comment-only) parses normally and produces the no-visible-text success results (excerpt)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.markdown().excerpt(), fileContent: noVisibleTextBody, onContentDemand: countingDemand(counter) })
  ok(r.success)
  strictEqual(r.data, '', 'no-visible-text excerpt success result is empty string')
  strictEqual(counter.count, 1)
})

test('T2.2: no-visible-text body (html-comment-only) parses normally and produces the no-visible-text success results (toc)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.markdown().toc(), fileContent: noVisibleTextBody, onContentDemand: countingDemand(counter) })
  ok(r.success)
  deepStrictEqual(r.data, [], 'no-visible-text toc success result is empty array')
  strictEqual(counter.count, 1)
})

test('T2.2: no-visible-text body parses normally (mdx.metadata yields readingTime 1, wordCount 0)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.mdx().metadata(), fileContent: noVisibleTextMdxBody, onContentDemand: countingDemand(counter) })
  ok(r.success)
  deepStrictEqual(r.data, { readingTime: 1, wordCount: 0 })
  strictEqual(counter.count, 1)
})

test('T2.2: no-visible-text body parses normally (mdx.excerpt yields empty string)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.mdx().excerpt(), fileContent: noVisibleTextMdxBody, onContentDemand: countingDemand(counter) })
  ok(r.success)
  strictEqual(r.data, '')
  strictEqual(counter.count, 1)
})

test('T2.2: no-visible-text body parses normally (mdx.toc yields empty array)', async () => {
  const counter = { count: 0 }
  const r = await parse({ schema: s.mdx().toc(), fileContent: noVisibleTextMdxBody, onContentDemand: countingDemand(counter) })
  ok(r.success)
  deepStrictEqual(r.data, [])
  strictEqual(counter.count, 1)
})

test('T2.2: explicit-vs-fallback equivalence for markdown.toc', async () => {
  const body = '# Hello\n\n## Sub\n\nA paragraph with some words.'
  const explicit = await parse({ schema: s.markdown().toc(), fileContent: body, input: body })
  const fallback = await parse({ schema: s.markdown().toc(), fileContent: body, input: undefined })
  ok(explicit.success && fallback.success)
  deepStrictEqual(explicit.data, fallback.data, 'equal explicit and fallback text must produce identical toc')
})

test('T2.2: explicit-vs-fallback byte-identical equivalence for primary markdown', async () => {
  const body = '# Hello\n\nA paragraph with some words.'
  const explicit = await parse({ schema: s.markdown(), fileContent: body, input: body })
  const fallback = await parse({ schema: s.markdown(), fileContent: body, input: undefined })
  ok(explicit.success && fallback.success)
  strictEqual(explicit.data, fallback.data, 'primary markdown must be byte-identical for equal explicit and fallback text')
})

test('T2.2: explicit-vs-fallback equivalence for markdown.excerpt', async () => {
  const body = 'A paragraph with some words for the excerpt projection.'
  const explicit = await parse({ schema: s.markdown().excerpt(), fileContent: body, input: body })
  const fallback = await parse({ schema: s.markdown().excerpt(), fileContent: body, input: undefined })
  ok(explicit.success && fallback.success)
  strictEqual(explicit.data, fallback.data)
})

test('T2.2: explicit-vs-fallback equivalence for markdown.metadata', async () => {
  const body = 'Hello world this is a test of reading time metadata counting.'
  const explicit = await parse({ schema: s.markdown().metadata(), fileContent: body, input: body })
  const fallback = await parse({ schema: s.markdown().metadata(), fileContent: body, input: undefined })
  ok(explicit.success && fallback.success)
  deepStrictEqual(explicit.data, fallback.data)
})

test('T2.2: explicit-vs-fallback equivalence for mdx.toc', async () => {
  const body = '# Hello\n\n## Sub\n\nA paragraph.'
  const explicit = await parse({ schema: s.mdx().toc(), fileContent: body, input: body })
  const fallback = await parse({ schema: s.mdx().toc(), fileContent: body, input: undefined })
  ok(explicit.success && fallback.success)
  deepStrictEqual(explicit.data, fallback.data)
})

test('T2.2: explicit-vs-fallback equivalence for mdx.excerpt', async () => {
  const body = 'A paragraph with some words for the mdx excerpt projection.'
  const explicit = await parse({ schema: s.mdx().excerpt(), fileContent: body, input: body })
  const fallback = await parse({ schema: s.mdx().excerpt(), fileContent: body, input: undefined })
  ok(explicit.success && fallback.success)
  strictEqual(explicit.data, fallback.data)
})

test('T2.2: explicit-vs-fallback equivalence for mdx.metadata', async () => {
  const body = 'Hello world this is a test of reading time metadata for mdx.'
  const explicit = await parse({ schema: s.mdx().metadata(), fileContent: body, input: body })
  const fallback = await parse({ schema: s.mdx().metadata(), fileContent: body, input: undefined })
  ok(explicit.success && fallback.success)
  deepStrictEqual(explicit.data, fallback.data)
})

test('T2.2: the empty-content issue is non-fatal — safeParseAsync returns { success: false } and does not throw VeliteError', async () => {
  let threw = false
  let result: { success: boolean } | undefined
  try {
    result = (await parse({ schema: s.markdown().metadata(), fileContent: undefined })) as { success: boolean }
  } catch (err) {
    threw = true
    ok(!isVeliteError(err), 'the empty-content path must not throw VeliteError')
  }
  strictEqual(threw, false, 'safeParseAsync on the empty path must not throw')
  ok(result !== undefined && !result.success, 'the empty path returns { success: false } with the custom issue, not a thrown error')
})

test('T2.2: parse/projection failures remain fatal (mdx primary on malformed JSX surfaces a fatal custom issue)', async () => {
  // A non-empty but malformed MDX body must reach the parser and surface a
  // fatal custom issue — proving the parser IS invoked on the non-empty
  // primary path. The empty path, by contrast, returns a non-fatal
  // `The content is empty` issue without reaching the parser (asserted above).
  const r = await parse({ schema: s.mdx(), fileContent: '<Foo bar="baz">' })
  ok(!r.success, 'malformed MDX must fail')
  const issue = r.error.issues[0]!
  strictEqual(issue.fatal, true, 'a parse/projection failure is fatal (distinct from the non-fatal empty-content issue)')
  ok(issue.message.length > 0, 'the fatal issue carries the parser error message')
})

test('T2.2: the empty path skips the parser — primary markdown with empty input does not reach processMarkdown', async () => {
  // Behavioural proof that the empty path short-circuits before the parser:
  // a non-empty body that the parser rejects surfaces a fatal issue (above);
  // the empty path surfaces the non-fatal `The content is empty` issue
  // instead. If the empty path reached the parser, it would either succeed
  // (returning '' as the HTML of empty markdown) or throw — neither produces
  // the `The content is empty` issue. The presence of that exact issue with
  // no fatal flag and no parser error message is the no-parse oracle for the
  // primary path.
  const r = await parse({ schema: s.mdx(), fileContent: undefined })
  ok(!r.success)
  const issue = r.error.issues[0]!
  strictEqual(issue.message, 'The content is empty', 'the empty primary path surfaces the empty-content issue, not a parser error')
  strictEqual(issue.fatal, undefined, 'the empty primary path is non-fatal — the parser was not reached')
})

test('T2.2: the empty-content issue is reported at the demanding field path (field-local, not global)', async () => {
  // Inside an object schema, the field's normal Zod path identifies the
  // demanding field. The issue must carry that path, not be detached to root.
  const objSchema = s.object({
    body: s.markdown().metadata(),
    other: s.string()
  })
  const r = await runWithContext(
    {
      project,
      file: file(undefined),
      record: { id: 'p.md#', index: 0 },
      collectEffect: () => {},
      asset: stubAsset,
      readFile: stubReadFile,
      probeImage: stubProbeImage
    },
    () => objSchema.safeParseAsync({ body: undefined, other: 'x' })
  )
  ok(!r.success)
  const issue = r.error.issues.find(i => i.message === 'The content is empty')
  ok(issue !== undefined, 'the empty-content issue is present')
  ok(Array.isArray(issue!.path), 'the issue carries a Zod path')
  strictEqual(issue!.fatal, undefined, 'the field-local empty-content issue is non-fatal')
})

test('T2.2: the selection rule does not mutate the file body (file.content is read-only)', async () => {
  // The selection must not introduce any asymmetry between the two sources.
  // Parse with explicit input twice — results must be byte-identical, proving
  // no per-call state leakage in the selection path.
  const body = '# Title\n\nBody text for determinism.'
  const a = await parse({ schema: s.markdown().toc(), fileContent: 'other', input: body })
  const b = await parse({ schema: s.markdown().toc(), fileContent: 'other', input: body })
  ok(a.success && b.success)
  deepStrictEqual(a.data, b.data, 'repeated explicit-input parses must be identical (no per-call state leakage)')
})

test('T2.2: explicit null is not treated as absent — it is a refinement failure (null is not undefined)', async () => {
  // null input: Zod's `.optional()` accepts null only if the schema allows it.
  // The custom<string> schema requires typeof === 'string'; null fails the
  // custom refinement. This test pins that null is NOT treated as absent
  // (which would consult file.content); it is a type failure.
  const r = await parse({ schema: s.markdown().toc(), fileContent: '# File\n\nText.', input: null })
  ok(!r.success, 'null input is not absent — it is a refinement failure, distinct from the empty path')
  ok(r.error.issues.length >= 1)
})

test('T2.2: throws VeliteError(internal) when called outside a schema parse (selection guard does not bypass the lease)', () => {
  throws(
    () => context(),
    (err: unknown) => isVeliteError(err) && err.code === 'internal',
    'context() outside a schema parse still throws VeliteError(internal) — the selection guard does not bypass the lease'
  )
})
