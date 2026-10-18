import { deepEqual, doesNotMatch, equal, match } from 'node:assert/strict'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

import type { Diagnostic } from '../../src/index'

const runtimeSpread = "export const runtimeProps = { children: 'Runtime Title' }\n\n<h1>Known <span {...runtimeProps} /></h1>"

const configuration = (schema: string): string => `import { content, defineConfig, s } from 'velite'
const doc=content.mdx({minify:false,outputFormat:'program',removeComments:false})
export default defineConfig({collections:{posts:{pattern:'*.mdx',schema:${schema}}}})`

const assertTitleLimitation = (diagnostics: readonly Diagnostic[]): void => {
  deepEqual(
    diagnostics.map(({ level, code, stage, message, provenance, position }) => ({ level, code, stage, message, provenance, position })),
    [
      {
        level: 'warn',
        code: 'CONTENT_WARNING',
        stage: 'schema',
        message: 'Cannot statically determine navigation for <h1>: title',
        provenance: {
          scope: 'record',
          collection: { order: 0, id: 'posts' },
          source: { path: 'post.mdx' },
          record: { id: 'post.mdx#', index: 0 }
        },
        position: undefined
      }
    ]
  )
}

const assertSpreadPreserved = (code: string): void => {
  match(code, /export const runtimeProps = \{\s*children: ["']Runtime Title["']\s*\}/u)
  match(code, /\("h1", \{/u)
  match(code, /children: \["Known ",/u)
  match(code, /\("span", \{\s*\.\.\.runtimeProps\s*\}\)/u)
}

const assertNoPartialAnchor = (code: string): void => {
  doesNotMatch(code, /\bid:\s*["'](?:known|heading)["']/u)
  match(code, /\("h1", \{\s*children:/u)
}

for (const request of [
  { name: 'TOC-only', schema: 's.object({toc:doc.toc()})', fields: ['toc'], code: false },
  { name: 'code before TOC', schema: 's.object({code:doc.code(),toc:doc.toc()})', fields: ['toc'], code: true },
  { name: 'TOC before code', schema: 's.object({toc:doc.toc(),code:doc.code()})', fields: ['toc'], code: true },
  { name: 'repeated TOC', schema: 's.object({toc:doc.toc(),again:doc.toc()})', fields: ['toc', 'again'], code: false },
  {
    name: 'late repeated TOC after code',
    schema:
      's.object({code:doc.code()}).transform(async value=>({...value,toc:await doc.toc().parseAsync(undefined),again:await doc.toc().parseAsync(undefined)}))',
    fields: ['toc', 'again'],
    code: true
  }
] as const)
  test(`content: nested MDX spreads cannot certify a complete navigation title (${request.name})`, async t => {
    const project = await contentProject(t, configuration(request.schema), { 'post.mdx': runtimeSpread })
    const result = await project.build()
    equal(result.output.collections.posts!.entries.length, 1)
    const value = result.output.collections.posts!.entries[0]!.data as { toc: unknown; again?: unknown; code?: string }
    await t.test('each requested TOC omits the uncertain heading', () => {
      for (const field of request.fields) deepEqual(value[field], [])
    })
    await t.test('one limitation warning has record provenance, no requester path or invented coordinates', () => {
      assertTitleLimitation(result.diagnostics)
    })
    if (request.code)
      await t.test('generated heading and nested spread are preserved without a partial-title anchor', () => {
        assertSpreadPreserved(value.code!)
        assertNoPartialAnchor(value.code!)
      })
  })

test('content: source-only nested MDX spreads keep known source text without a navigation warning', async t => {
  const project = await contentProject(t, configuration('s.object({text:doc.excerpt(),meta:doc.metadata()})'), { 'post.mdx': runtimeSpread })
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  equal(result.output.collections.posts!.entries.length, 1)
  deepEqual(result.output.collections.posts!.entries[0]!.data, { text: 'Known', meta: { readingTime: 1, wordCount: 1 } })
})

test('content: code-only nested MDX spreads avoid both irrelevant warnings and invented static anchors', async t => {
  const project = await contentProject(t, configuration('s.object({code:doc.code()})'), { 'post.mdx': runtimeSpread })
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  equal(result.output.collections.posts!.entries.length, 1)
  const value = result.output.collections.posts!.entries[0]!.data as { code: string }
  await t.test('the runtime spread and known JSX children remain in generated code', () => {
    assertSpreadPreserved(value.code)
  })
  await t.test('uncertain titles do not acquire a generated static target even without a TOC demand', () => {
    assertNoPartialAnchor(value.code)
  })
})

for (const fixture of [
  { name: 'fully static intrinsic children', text: '<h1>Known <span>More</span></h1>' },
  { name: 'retained expression comments', text: '<h1>Known {/* not title text */}<span>More</span></h1>' },
  {
    name: 'attributes are not title text or runtime children inference',
    text: 'export const runtimeProps = { children: \'Attribute Title\' }\n\n<h1>Known <span children="Attribute children" data-label="Attribute label" title={runtimeProps.children}>More</span></h1>'
  }
] as const)
  test(`content: static MDX descendants retain independently expected titles and actual anchors (${fixture.name})`, async t => {
    const project = await contentProject(t, configuration('s.object({toc:doc.toc(),code:doc.code()})'), { 'post.mdx': fixture.text })
    const result = await project.build()
    deepEqual(result.diagnostics, [])
    equal(result.output.collections.posts!.entries.length, 1)
    const value = result.output.collections.posts!.entries[0]!.data as { toc: unknown; code: string }
    deepEqual(value.toc, [{ depth: 1, title: 'Known More', id: 'known-more' }])
    match(value.code, /\("h1", \{\s*id: "known-more",\s*children:/u)
    match(value.code, /\("span", \{/u)
  })

test('content: nested expression-valued MDX children remain runtime-dependent without evaluating imports or code', async t => {
  const project = await contentProject(t, configuration('s.object({toc:doc.toc(),code:doc.code()})'), {
    'post.mdx':
      "import Never from 'never-load-static-descendants'\n\nexport const runtimeProps = (() => { throw new Error('must not execute') })()\n\n<h1>Known <em><span children={runtimeProps.children} /></em></h1>\n\n<Never />"
  })
  const result = await project.build()
  equal(result.output.collections.posts!.entries.length, 1)
  const value = result.output.collections.posts!.entries[0]!.data as { toc: unknown; code: string }
  await t.test('nested runtime children cannot publish the partial Known title', () => {
    deepEqual(value.toc, [])
  })
  await t.test('the unknown component is not invented as another heading warning', () => {
    assertTitleLimitation(result.diagnostics)
  })
  await t.test('ordinary generated code keeps imports, runtime expressions and intrinsic descendants', () => {
    match(value.code, /never-load-static-descendants/u)
    match(value.code, /throw new Error\(["']must not execute["']\)/u)
    match(value.code, /\("em", \{/u)
    match(value.code, /\("span", \{\s*children: runtimeProps\.children\s*\}\)/u)
    assertNoPartialAnchor(value.code)
  })
})

for (const descendant of [
  { name: 'nested spread', text: '<span {...runtimeProps} />' },
  { name: 'expression-valued children', text: '<span children={runtimeProps.children} />' }
] as const)
  test(`content: uncertain MDX titles preserve and reserve valid explicit targets (${descendant.name})`, async t => {
    const project = await contentProject(t, configuration('s.object({toc:doc.toc(),again:doc.toc(),code:doc.code()})'), {
      'post.mdx': `export const runtimeProps = { children: 'Runtime Title' }\n\n<h2>Known</h2>\n\n<h1 id="known">Known ${descendant.text}</h1>\n\n<h2>Known</h2>`
    })
    const result = await project.build()
    equal(result.output.collections.posts!.entries.length, 1)
    const value = result.output.collections.posts!.entries[0]!.data as { toc: unknown; again: unknown; code: string }
    await t.test('actual output reserves the forward known target and preserves the uncertain heading ID', () => {
      match(value.code, /\("h1", \{\s*id: "known",\s*children:/u)
      match(value.code, /\("h2", \{\s*id: "known-1",\s*children: "Known"\s*\}\)/u)
      match(value.code, /\("h2", \{\s*id: "known-2",\s*children: "Known"\s*\}\)/u)
      if (descendant.name === 'nested spread') match(value.code, /\("span", \{\s*\.\.\.runtimeProps\s*\}\)/u)
      else match(value.code, /\("span", \{\s*children: runtimeProps\.children\s*\}\)/u)
    })
    await t.test('both TOC deliveries contain only navigable neighbors with independently expected IDs', () => {
      const expected = [
        { depth: 2, title: 'Known', id: 'known-1' },
        { depth: 2, title: 'Known', id: 'known-2' }
      ]
      deepEqual(value.toc, expected)
      deepEqual(value.again, expected)
    })
    await t.test('repeated TOC demands report exactly one record-owned title limitation', () => {
      assertTitleLimitation(result.diagnostics)
    })
  })
