// Content Definitions configure a dialect; their finite methods return ordinary
// async Zod result schemas. Definitions themselves are not schemas.
import { deepStrictEqual, equal, notStrictEqual, ok, rejects, throws } from 'node:assert/strict'
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

const file = (fileContent: string): ContentFile => ({
  id: 'posts/hello.md',
  path: '/proj/content/posts/hello.md',
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

const parseWith = async <T>(schema: Schema<T>, fileContent: string, input: unknown = undefined) =>
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

test('content.markdown(): exposes exactly the finite Markdown result factories', () => {
  const definition = content.markdown()
  deepStrictEqual(Reflect.ownKeys(definition).sort(), ['excerpt', 'html', 'metadata', 'toc'])
  for (const factory of [definition.html, definition.toc, definition.excerpt, definition.metadata]) equal(typeof factory, 'function')
})

test('content.mdx(): exposes exactly the finite MDX result factories', () => {
  const definition = content.mdx()
  deepStrictEqual(Reflect.ownKeys(definition).sort(), ['code', 'excerpt', 'metadata', 'toc'])
  for (const factory of [definition.code, definition.toc, definition.excerpt, definition.metadata]) equal(typeof factory, 'function')
})

test('content: definitions are not Zod schemas or public lifecycle/projection services', () => {
  for (const definition of [content.markdown(), content.mdx()]) {
    for (const name of ['parse', 'parseAsync', 'safeParse', 'safeParseAsync', 'optional', 'transform', 'project', 'close']) {
      equal((definition as unknown as Record<string, unknown>)[name], undefined, `definitions have no ${name} method`)
    }
  }
})

test('content: each finite result factory constructs an ordinary Zod schema', () => {
  const markdown = content.markdown()
  const mdx = content.mdx()
  const schemas = [
    markdown.html(),
    markdown.toc(),
    markdown.excerpt(),
    markdown.excerpt({ length: 50 }),
    markdown.metadata(),
    mdx.code(),
    mdx.toc(),
    mdx.excerpt(),
    mdx.metadata()
  ]
  for (const schema of schemas) {
    equal(typeof schema.safeParseAsync, 'function')
    equal(typeof schema.optional, 'function')
    equal(typeof schema.transform, 'function')
  }
  notStrictEqual(markdown.toc(), markdown.toc(), 'each factory call returns a new result schema')
})

test('content: standalone TOC selections return exact navigation items for either dialect', async () => {
  for (const definition of [content.markdown(), content.mdx()]) {
    const result = await parseWith(definition.toc(), '# Hello\n\n## Sub')
    ok(result.success)
    deepStrictEqual(result.data, [
      { depth: 1, title: 'Hello', id: 'hello' },
      { depth: 2, title: 'Sub', id: 'sub' }
    ])
  }
})

test('content: standalone excerpt selections return normalized source text for either dialect', async () => {
  for (const definition of [content.markdown(), content.mdx()]) {
    const result = await parseWith(definition.excerpt(), 'one two three four five six seven')
    ok(result.success)
    equal(result.data, 'one two three four five six seven')
  }
})

test('content: excerpt length selects exact Unicode-code-point truncation', async () => {
  for (const definition of [content.markdown(), content.mdx()]) {
    const result = await parseWith(definition.excerpt({ length: 10 }), 'one two three four five six seven')
    ok(result.success)
    equal(result.data, 'one two th…')
  }
})

test('content: standalone metadata selections return exact source counts for either dialect', async () => {
  for (const definition of [content.markdown(), content.mdx()]) {
    const result = await parseWith(definition.metadata(), 'Hello world this is a test of reading time metadata.')
    ok(result.success)
    deepStrictEqual(result.data, { readingTime: 1, wordCount: 10 })
  }
})

test('content: s contains no legacy content factories or standalone selections', () => {
  for (const name of ['markdown', 'mdx', 'toc', 'excerpt', 'metadata', 'content']) {
    equal((s as Record<string, unknown>)[name], undefined, `s.${name} must be removed`)
    ok(!Object.keys(s).includes(name), `${name} is not an own key`)
  }
})

test('content: context() outside a schema parse throws VeliteError(internal)', () => {
  throws(
    () => context(),
    (error: unknown) => isVeliteError(error) && error.code === 'internal'
  )
})

test('content: parsing a result schema outside a schema run rejects with VeliteError(internal)', async () => {
  await rejects(content.markdown().toc().safeParseAsync(undefined), (error: unknown) => isVeliteError(error) && error.code === 'internal')
})

test('content: constructing definitions and result schemas requests no content work', async () => {
  let demands = 0
  let attaches = 0
  await runWithContext(
    {
      project,
      file: file('# Hello\n\nA paragraph with visible text.'),
      record: { id: 'posts/hello.md#', index: 0 },
      collectEffect: () => {},
      asset: stubAsset,
      readFile: stubReadFile,
      probeImage: stubProbeImage,
      onContentDemand: () => {
        demands++
      }
    },
    async () => {
      const definition = content.markdown({
        remarkPlugins: [
          () => {
            attaches++
          }
        ]
      })
      const schemas = [definition.html(), definition.toc(), definition.excerpt(), definition.metadata()]
      equal(demands, 0)
      equal(attaches, 0)

      const result = await schemas[1]!.safeParseAsync(undefined)
      ok(result.success)
      deepStrictEqual(result.data, [{ depth: 1, title: 'Hello', id: 'hello' }])
      equal(demands, 1, 'one parsed result schema makes one raw request')
      equal(attaches, 1)

      definition.excerpt({ length: 5 })
      definition.metadata()
      equal(demands, 1, 'constructing further result schemas makes no request')
      equal(attaches, 1)
    }
  )
})

test('content: separate factory calls create distinct definitions', () => {
  notStrictEqual(content.markdown(), content.markdown())
  notStrictEqual(content.mdx(), content.mdx())
})

test('content: zero excerpt length is valid and appends the ellipsis for non-empty source text', async () => {
  const result = await parseWith(content.markdown().excerpt({ length: 0 }), 'abc')
  ok(result.success)
  equal(result.data, '…')
})

test('content: one definition and its unbound methods support generated content plus sibling selections', async () => {
  const definition = content.markdown()
  const { html, toc, excerpt, metadata } = definition
  const schema = s.object({ content: html(), toc: toc(), excerpt: excerpt(), metadata: metadata() })
  const body = '# Title\n\nBody text with some words for reading time.'
  const result = await parseWith(schema, body, { content: body })
  ok(result.success)
  deepStrictEqual(result.data, {
    content: '<h1 id="title">Title</h1>\n<p>Body text with some words for reading time.</p>',
    toc: [{ depth: 1, title: 'Title', id: 'title' }],
    excerpt: 'Title Body text with some words for reading time.',
    metadata: { readingTime: 1, wordCount: 9 }
  })
})

test('content: result schemas retain ordinary Zod transforms and pipes', async () => {
  const schema = content
    .markdown()
    .toc()
    .transform(items => items.map(item => item.id))
    .pipe(s.array(s.string()))
  const result = await parseWith(schema, '# Hello\n\n## Sub')
  ok(result.success)
  deepStrictEqual(result.data, ['hello', 'sub'])
})
