// Exact input selection for finite content result schemas: primitive strings
// win, absent inputs fall back to file.content, and missing/exactly-empty
// selected text creates a field-local issue without requesting content work.
import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert/strict'
import { test } from 'node:test'

import { isVeliteError } from '../../src/core/diagnostic'
import { content } from '../../src/core/schema/content'
import { context } from '../../src/core/schema/context'
import { s } from '../../src/core/schema/s'
import { runWithContext } from '../helpers/schema-context'

import type { AssetResult } from '../../src/core/assets'
import type { ContentFile, ProjectInfo } from '../../src/core/schema/context'
import type { Schema } from '../../src/core/schema/s'

const project: ProjectInfo = {
  root: '/proj/content',
  configPath: '/proj/velite.config.ts',
  collections: {},
  output: { data: '/proj/.velite', assets: '/proj/public/static', base: '/static/', name: 'static' }
}

const file = (fileContent: string | undefined): ContentFile => ({
  id: 'p.md',
  path: '/proj/content/p.md',
  content: fileContent
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
  readonly onContentDemand?: () => void
}

const parse = async ({ schema, fileContent, input, onContentDemand }: ParseInput) =>
  runWithContext(
    {
      project,
      file: file(fileContent),
      record: { id: 'p.md#', index: 0 },
      collectEffect: () => {},
      asset: stubAsset,
      readFile: stubReadFile,
      probeImage: stubProbeImage,
      onContentDemand
    },
    () => schema.safeParseAsync(input)
  )

const markdown = content.markdown()
const mdx = content.mdx()
const selections = [
  { name: 'markdown.html', schema: markdown.html },
  { name: 'markdown.toc', schema: markdown.toc },
  { name: 'markdown.excerpt', schema: markdown.excerpt },
  { name: 'markdown.metadata', schema: markdown.metadata },
  { name: 'mdx.code', schema: mdx.code },
  { name: 'mdx.toc', schema: mdx.toc },
  { name: 'mdx.excerpt', schema: mdx.excerpt },
  { name: 'mdx.metadata', schema: mdx.metadata }
]

for (const selection of selections) {
  test(`selected input: ${selection.name} selects explicit '' over a non-empty file body without a demand`, async () => {
    let demands = 0
    const result = await parse({
      schema: selection.schema(),
      fileContent: '# File Title\n\nBody text.',
      input: '',
      onContentDemand: () => {
        demands++
      }
    })
    ok(!result.success)
    deepStrictEqual(result.error.issues, [{ code: 'custom', message: 'The content is empty', path: [] }])
    strictEqual(demands, 0)
  })

  test(`selected input: ${selection.name} rejects a missing or exactly-empty fallback without a demand`, async () => {
    for (const fileContent of [undefined, '']) {
      let demands = 0
      const result = await parse({
        schema: selection.schema(),
        fileContent,
        onContentDemand: () => {
          demands++
        }
      })
      ok(!result.success)
      deepStrictEqual(result.error.issues, [{ code: 'custom', message: 'The content is empty', path: [] }])
      strictEqual(demands, 0)
    }
  })

  test(`selected input: ${selection.name} rejects non-string inputs instead of falling back`, async () => {
    for (const input of [null, 42, false, {}, new String('Explicit')]) {
      let demands = 0
      const result = await parse({
        schema: s.object({ body: selection.schema() }),
        fileContent: '# File Title\n\nBody text.',
        input: { body: input },
        onContentDemand: () => {
          demands++
        }
      })
      ok(!result.success)
      strictEqual(result.error.issues.length, 1)
      strictEqual(result.error.issues[0]!.code, 'invalid_type')
      deepStrictEqual(result.error.issues[0]!.path, ['body'])
      strictEqual(demands, 0)
    }
  })

  test(`selected input: ${selection.name} gives identical results for equal explicit and fallback text`, async () => {
    const body = '# Hello\n\n## Sub\n\nA paragraph with some words.'
    const schema = selection.schema()
    const explicit = await parse({ schema, fileContent: body, input: body })
    const fallback = await parse({ schema, fileContent: body })
    ok(explicit.success && fallback.success)
    deepStrictEqual(explicit.data, fallback.data)
  })
}

test('selected input: Markdown TOC reflects explicit text rather than the file body', async () => {
  const result = await parse({ schema: markdown.toc(), fileContent: '# File Title\n\n## File Sub', input: '# Explicit Title\n\n## Explicit Sub' })
  ok(result.success)
  deepStrictEqual(result.data, [
    { depth: 1, title: 'Explicit Title', id: 'explicit-title' },
    { depth: 2, title: 'Explicit Sub', id: 'explicit-sub' }
  ])
})

test('selected input: Markdown excerpt reflects explicit text rather than the file body', async () => {
  const result = await parse({ schema: markdown.excerpt(), fileContent: 'File body text here.', input: 'Explicit excerpt text here.' })
  ok(result.success)
  strictEqual(result.data, 'Explicit excerpt text here.')
})

test('selected input: Markdown metadata counts explicit text rather than the file body', async () => {
  const result = await parse({
    schema: markdown.metadata(),
    fileContent: 'aaa bbb ccc',
    input: 'one two three four five six seven eight nine ten eleven twelve thirteen'
  })
  ok(result.success)
  deepStrictEqual(result.data, { readingTime: 1, wordCount: 13 })
})

test('selected input: Markdown HTML renders explicit text rather than the file body', async () => {
  const result = await parse({ schema: markdown.html(), fileContent: '# File Body', input: '# Explicit Body' })
  ok(result.success)
  strictEqual(result.data, '<h1 id="explicit-body">Explicit Body</h1>')
})

const noVisibleTextBody = '<!-- only an html comment, no statically visible text -->'
const noVisibleTextMdxBody = '{/* only an mdx expression comment, no statically visible text */}'
const analysisSelections = [
  { name: 'markdown.toc', schema: markdown.toc, comment: noVisibleTextBody, expected: [] },
  { name: 'markdown.excerpt', schema: markdown.excerpt, comment: noVisibleTextBody, expected: '' },
  { name: 'markdown.metadata', schema: markdown.metadata, comment: noVisibleTextBody, expected: { readingTime: 1, wordCount: 0 } },
  { name: 'mdx.toc', schema: mdx.toc, comment: noVisibleTextMdxBody, expected: [] },
  { name: 'mdx.excerpt', schema: mdx.excerpt, comment: noVisibleTextMdxBody, expected: '' },
  { name: 'mdx.metadata', schema: mdx.metadata, comment: noVisibleTextMdxBody, expected: { readingTime: 1, wordCount: 0 } }
]

for (const selection of analysisSelections) {
  test(`selected input: ${selection.name} processes whitespace and non-empty comment-only sources normally`, async () => {
    for (const fileContent of ['   \n\n\t  ', selection.comment]) {
      let demands = 0
      const result = await parse({
        schema: selection.schema(),
        fileContent,
        onContentDemand: () => {
          demands++
        }
      })
      ok(result.success)
      deepStrictEqual(result.data, selection.expected)
      strictEqual(demands, 1, 'a non-empty source requests processing even without visible text')
    }
  })
}

test('selected input: malformed MDX creates an ordinary field-local issue and permits native catch recovery', async () => {
  const fileContent = '<Foo bar="baz">'
  const failed = await parse({ schema: s.object({ body: mdx.code() }), fileContent, input: {} })
  ok(!failed.success)
  strictEqual(failed.error.issues.length, 1)
  const issue = failed.error.issues[0]!
  strictEqual(issue.code, 'custom')
  deepStrictEqual(issue.path, ['body'])
  strictEqual((issue as { fatal?: boolean }).fatal, undefined)
  ok(/closing tag.*Foo/.test(issue.message), issue.message)

  const recovered = await parse({ schema: mdx.code().catch('fallback'), fileContent })
  ok(recovered.success)
  strictEqual(recovered.data, 'fallback')
})

test('selected input: each empty-content issue belongs to its demanding field, not a global fatal error', async () => {
  let demands = 0
  const schema = s.object({ html: markdown.html(), toc: markdown.toc(), excerpt: markdown.excerpt(), metadata: markdown.metadata(), code: mdx.code() })
  const result = await parse({
    schema,
    input: {},
    onContentDemand: () => {
      demands++
    }
  })
  ok(!result.success)
  deepStrictEqual(result.error.issues.map(issue => issue.path).sort(), [['code'], ['excerpt'], ['html'], ['metadata'], ['toc']])
  for (const issue of result.error.issues) {
    strictEqual(issue.code, 'custom')
    strictEqual(issue.message, 'The content is empty')
    strictEqual((issue as { fatal?: boolean }).fatal, undefined)
  }
  strictEqual(demands, 0)
})

test('selected input: selecting explicit text never mutates the public file body', async () => {
  const body = '# File Title\n\nFile body.'
  await runWithContext(
    {
      project,
      file: file(body),
      record: { id: 'p.md#', index: 0 },
      collectEffect: () => {},
      asset: stubAsset,
      readFile: stubReadFile,
      probeImage: stubProbeImage
    },
    async () => {
      const schema = markdown.toc()
      const first = await schema.safeParseAsync('# Explicit Title')
      const second = await schema.safeParseAsync('# Explicit Title')
      ok(first.success && second.success)
      deepStrictEqual(first.data, [{ depth: 1, title: 'Explicit Title', id: 'explicit-title' }])
      deepStrictEqual(second.data, first.data)
      strictEqual(context().file.content, body)
    }
  )
})

test('selected input: the selection guard does not bypass the schema context lease', () => {
  throws(
    () => context(),
    (error: unknown) => isVeliteError(error) && error.code === 'internal'
  )
})
