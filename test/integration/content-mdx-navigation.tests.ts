import { deepEqual, equal, match } from 'node:assert/strict'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

test('content: static MDX navigation runs before code conversion and awaits full recma without emission', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
let recmas=0,emits=0
function edit(){return tree=>{tree.children.find(node=>node.tagName==='h1').children[0].value='Changed'}}
function recma(){const processor=this;return ()=>{recmas++;const emit=processor.compiler;processor.compiler=(...args)=>{emits++;return emit(...args)}}}
const doc=content.mdx({minify:false,rehypePlugins:[edit],recmaPlugins:[recma]})
export default defineConfig({collections:{posts:{pattern:'*.mdx',schema:s.object({toc:doc.toc()}).transform(async value=>{const before=emits;return {...value,before,code:await doc.code().parseAsync(undefined),late:await doc.toc().parseAsync(undefined),source:await doc.excerpt().parseAsync(undefined),recmas,emits}})}}})`,
    { 'post.mdx': '# Original\n\n<h2>Crème <strong>茶</strong></h2>\n\n<div id="changed" />\n\n<Panel id="crème-茶" />' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const value = result.output.collections.posts!.entries[0]!.data as {
    toc: unknown
    before: number
    code: string
    late: unknown
    source: string
    recmas: number
    emits: number
  }
  const toc = [
    { depth: 1, title: 'Changed', id: 'changed-1' },
    { depth: 2, title: 'Crème 茶', id: 'crème-茶-1' }
  ]
  deepEqual(value.toc, toc)
  deepEqual(value.late, toc)
  deepEqual([value.before, value.source, value.recmas, value.emits], [0, 'Original Crème 茶', 1, 1])
  match(value.code, /id: "changed-1"/)
  match(value.code, /id: "crème-茶-1"/)
})

test('content: MDX dynamic title/ID/spread limits preserve code and warn only for actual late navigation', async t => {
  const text =
    'export const danger = (() => { throw new Error(\'must not execute\') })()\nexport const props = {id:\'runtime\'}\n\n# Simple\n\n<div id="simple" />\n\n<h2 id={\'looks-static\'}>Expression ID</h2>\n\n<h3 {...props} id="declared">Spread</h3>\n\n<h4 id="keep">Partial {danger}</h4>\n\n<h5><Panel>Known children</Panel></h5>\n\n<h6> </h6>\n\n<Heading>Unknown heading</Heading>'
  for (const mode of ['source', 'code', 'late'])
    await t.test(mode, async t => {
      const schema =
        mode === 'source'
          ? 's.object({text:doc.excerpt()})'
          : `s.object({code:doc.code()})${mode === 'late' ? '.transform(async value=>({...value,toc:await doc.toc().parseAsync(undefined),again:await doc.toc().parseAsync(undefined)}))' : ''}`
      const project = await contentProject(
        t,
        `import { content, defineConfig, s } from 'velite'
const doc=content.mdx({minify:false})
export default defineConfig({collections:{posts:{pattern:'*.mdx',schema:${schema}}}})`,
        { 'post.mdx': text }
      )
      const result = await project.build()
      const value = result.output.collections.posts!.entries[0]!.data as { code?: string; toc?: unknown; again?: unknown }
      equal(result.diagnostics.length, mode === 'late' ? 4 : 0)
      if (mode !== 'source') {
        match(value.code!, /id: "simple-1"/)
        match(value.code!, /id: 'looks-static'/)
        match(value.code!, /\.\.\.props/)
        match(value.code!, /id: "declared"/)
        match(value.code!, /id: "keep"/)
        match(value.code!, /id: "heading"/)
      }
      if (mode === 'late') {
        deepEqual(value.toc, [{ depth: 1, title: 'Simple', id: 'simple-1' }])
        deepEqual(value.again, value.toc)
        deepEqual(
          result.diagnostics.map(issue => issue.message),
          [
            'Cannot statically determine navigation for <h2>: target',
            'Cannot statically determine navigation for <h3>: target',
            'Cannot statically determine navigation for <h4>: title',
            'Cannot statically determine navigation for <h5>: title'
          ]
        )
        for (const issue of result.diagnostics)
          deepEqual(issue.provenance, {
            scope: 'record',
            collection: { order: 0, id: 'posts' },
            source: { path: 'post.mdx' },
            record: { id: 'post.mdx#', index: 0 }
          })
      }
    })
})

test('content: late recma failure withholds provisional MDX navigation without retry but retains source', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
let recmas=0
function fail(){return async ()=>{recmas++;await Promise.resolve();throw new Error('late recma rejection')}}
const doc=content.mdx({recmaPlugins:[fail]})
export default defineConfig({collections:{posts:{pattern:'*.mdx',schema:s.object({a:doc.toc().catch([]),b:doc.toc().catch([]),code:doc.code().catch('fallback'),source:doc.excerpt()}).transform(value=>({...value,recmas}))}}})`,
    { 'post.mdx': '# Source' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, { a: [], b: [], code: 'fallback', source: 'Source', recmas: 1 })
})

test('content: literal JSX IDs reserve unknown components and reject conflicts and bare IDs', async t => {
  for (const [text, valid] of [
    ['# Reserve\n\n<Panel id="reserve" />', true],
    ['<h2 id="same">Title</h2>\n\n<Panel id="same" />', false],
    ['<h2 id>Title</h2>', false]
  ] as const)
    await t.test(text, async t => {
      const project = await contentProject(
        t,
        `import {content,defineConfig,s} from 'velite'
const doc=content.mdx({minify:false})
export default defineConfig({collections:{posts:{pattern:'*.mdx',schema:s.object({toc:doc.toc(),code:doc.code()})}}})`,
        { 'post.mdx': text }
      )
      const result = await project.build()
      if (valid) {
        deepEqual(result.diagnostics, [])
        deepEqual((result.output.collections.posts!.entries[0]!.data as { toc: unknown }).toc, [{ depth: 1, title: 'Reserve', id: 'reserve-1' }])
      } else {
        equal(result.diagnostics.length, 2)
        deepEqual(result.output.collections.posts!.entries, [])
      }
    })
})
