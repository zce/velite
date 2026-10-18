import { deepEqual, equal, match } from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

test('content: navigation follows transformed HTML, reserves forward targets, and late HTML resumes without replay', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
let runs=0,emits=0
function edit(){const processor=this;return tree=>{runs++;const headings=tree.children.filter(node=>node.tagName==='h1');tree.children=[headings[1],{type:'element',tagName:'h2',properties:{id:'Stable:ID'},children:[{type:'text',value:'Added'}]},headings[0],{type:'element',tagName:'div',properties:{id:'intro'},children:[]}];const emit=processor.compiler;processor.compiler=(...args)=>{emits++;return emit(...args)}}}
const doc=content.markdown({rehypePlugins:[edit]})
export default defineConfig({collections:{posts:{pattern:'*.md',schema:s.object({toc:doc.toc(),again:doc.toc()}).transform(async value=>{const before=emits;return {...value,before,html:await doc.html().parseAsync(undefined),source:await doc.excerpt().parseAsync(undefined),runs,emits}})}}})`,
    { 'post.md': '# Intro\n\n# Second' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const value = result.output.collections.posts!.entries[0]!.data as {
    toc: unknown
    again: unknown
    before: number
    html: string
    source: string
    runs: number
    emits: number
  }
  deepEqual(value.toc, [
    { depth: 1, title: 'Second', id: 'second' },
    { depth: 2, title: 'Added', id: 'Stable:ID' },
    { depth: 1, title: 'Intro', id: 'intro-1' }
  ])
  deepEqual(value.again, value.toc)
  equal(value.html, '<h1 id="second">Second</h1><h2 id="Stable:ID">Added</h2><h1 id="intro-1">Intro</h1><div id="intro"></div>')
  deepEqual([value.before, value.source, value.runs, value.emits], [0, 'Intro Second', 1, 1])
})

test('content: reviewed Unicode anchors and whole-document reservations have independent exact values', async t => {
  const titles = [
    'Hello, WORLD!',
    'Crème 茶',
    'Cafe\u0301',
    'Café',
    'q\u0301',
    'İ',
    'foo_bar--Baz',
    '  -- A - 💡 - B --  ',
    'ab/cd',
    '🔥',
    '!!!',
    'Repeat',
    'Repeat',
    'Repeat',
    'Repeat',
    'Hello-1',
    'Hello',
    'Hello',
    'Intro',
    'Intro',
    ''
  ]
  const expected = [
    'hello-world',
    'crème-茶',
    'café',
    'café-1',
    'q\u0301',
    'i\u0307',
    'foo_bar-baz',
    'a-b',
    'abcd',
    'heading-1',
    'heading-2',
    'repeat',
    'repeat-2',
    'repeat-4',
    'repeat-5',
    'hello-1',
    'hello',
    'hello-2',
    'intro-1',
    'intro-2',
    'heading-3'
  ]
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
const titles=${JSON.stringify(titles)},reserved=['intro','repeat-1','repeat-3','heading','Intro','é','é']
function fixtures(){return tree=>{tree.children=[...titles.map(value=>({type:'element',tagName:'h3',properties:{},children:[{type:'text',value}]})),...reserved.map(id=>({type:'element',tagName:'div',properties:{id},children:[]}))]}}
const doc=content.markdown({rehypePlugins:[fixtures]})
export default defineConfig({collections:{posts:{pattern:'*.md',schema:s.object({html:doc.html(),toc:doc.toc()})}}})`,
    { 'post.md': 'Source' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const value = result.output.collections.posts!.entries[0]!.data as { html: string; toc: { depth: number; title: string; id: string }[] }
  deepEqual(
    [...value.html.matchAll(/<h3 id="([^"]*)">/g)].map(item => item[1]),
    expected
  )
  deepEqual(
    value.toc.map(item => item.id),
    expected.slice(0, -1)
  )
  deepEqual(
    value.toc.map(item => item.title),
    titles.slice(0, -1).map(title => title.replace(/\s+/gu, ' ').trim())
  )
  for (const item of value.toc) equal(item.depth, 3)
})

test('content: explicit targets obey HTML rules, preserve legal values, and reject every conflict without a winner', async t => {
  const cases: [string, string, boolean][] = [
    ['heading/non-heading duplicate', '<h1 id="same">Title</h1><div id="same"></div>', false],
    ['non-heading duplicate', '<div id="same"></div><span id="same"></span>', false],
    ['empty', '<h1 id="">Title</h1>', false],
    ['ASCII space', '<h1 id="a b">Title</h1>', false],
    ['legal non-ASCII whitespace', '<h1 id="a\u00a0b">Title</h1>', true],
    ['legal punctuation', '<h1 id="0:A">Title</h1>', true]
  ]
  for (const [name, text, valid] of cases)
    await t.test(name, async t => {
      const project = await contentProject(
        t,
        `import { content, defineConfig, s } from 'velite'
const doc=content.markdown()
export default defineConfig({collections:{posts:{pattern:'*.md',schema:s.object({toc:doc.toc(),html:doc.html(),source:doc.excerpt()})}}})`,
        { 'post.md': text }
      )
      const result = await project.build()
      if (valid) {
        deepEqual(result.diagnostics, [])
        const value = result.output.collections.posts!.entries[0]!.data as { toc: { id: string }[]; html: string }
        equal(value.toc[0]!.id, text.match(/id="([^"]*)"/)![1])
        match(value.html, /id=/)
      } else {
        deepEqual(result.output.collections.posts!.entries, [])
        deepEqual(
          result.diagnostics.map(issue => (issue.provenance.scope === 'record' ? issue.provenance.path : undefined)),
          [['toc'], ['html']]
        )
        for (const issue of result.diagnostics) match(issue.message, /explicit content id/)
      }
    })
})

test('content: TOC-only transforms and resolves assets, while recovered Emit failure retains navigation', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
let runs=0,emits=0
function failure(){const processor=this;return ()=>{runs++;processor.compiler=()=>{emits++;throw new Error('emit failed')}}}
const doc=content.markdown({rehypePlugins:[failure]})
export default defineConfig({output:{name:'[name].[ext]'},collections:{posts:{pattern:'*.md',schema:s.object({toc:doc.toc()}).transform(async value=>{const before=emits;return {...value,before,html:await doc.html().catch('fallback').parseAsync(undefined),late:await doc.toc().parseAsync(undefined),source:await doc.excerpt().parseAsync(undefined),runs,emits}})}}})`,
    { 'post.md': '# Title\n\n[Asset](./asset.txt)', 'asset.txt': 'asset' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const toc = [{ depth: 1, title: 'Title', id: 'title' }]
  deepEqual(result.output.collections.posts!.entries[0]!.data, { toc, before: 0, html: 'fallback', late: toc, source: 'Title Asset', runs: 1, emits: 1 })
  deepEqual(await readdir(join(project.dir, 'public/static')), ['asset.txt'])
})
