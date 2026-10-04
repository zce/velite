// Relevant legacy continuation/identity regressions, expressed through the
// packaged semantic execution contract. No branch/seed/cache inspection seam.
import { deepEqual, equal, match, ok } from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

test('content record: canonical path/cwd and ordinary history/private data survive every owned phase', async t => {
  const project = await contentProject(
    t,
    `import {content,defineConfig,s} from 'velite'
const observed=[]
function parser(){const parse=this.parser;this.parser=(text,file)=>{observed.push({phase:'parse',path:file.path,cwd:file.cwd,value:String(file),history:[...file.history]});const privateData={map:new Map([['key',text]]),symbol:Symbol('private'),fn:()=>text,weak:new WeakMap()};privateData.self=privateData;privateData.weak.set(file,privateData);file.data.private=privateData;file.path='/parse-moved.md';return parse(text,file)};return (tree,file)=>{if(file.data.private.weak.get(file)!==file.data.private||file.data.private.self!==file.data.private||file.data.private.fn()!=='# Explicit')throw new Error('lost opaque data');observed.push({phase:'transform',path:file.path});file.path='/transform-moved.md';tree.children[0].children[0].value='Changed';file.message('shared warning')}}
function compiler(){const processor=this;return()=>{const emit=processor.compiler;processor.compiler=(tree,file)=>{observed.push({phase:'emit',path:file.path,history:[...file.history],private:file.data.private.map.get('key')});return emit(tree,file)}}}
const doc=content.markdown({remarkPlugins:[parser],rehypePlugins:[compiler]})
export default defineConfig({collections:{posts:{pattern:'*.md',schema:s.object({html:doc.html(),again:doc.html()}).transform(async value=>({...value,source:await doc.excerpt().parseAsync('# Explicit'),observed}))}}})`,
    { 'post.md': '---\nhtml: "# Explicit"\nagain: "# Explicit"\n---\n# Fallback' }
  )
  const result = await project.build(),
    value = result.output.collections.posts!.entries[0]!.data as { html: string; again: string; source: string; observed: unknown[] }
  equal(value.html, '<h1 id="changed">Changed</h1>')
  equal(value.again, value.html)
  equal(value.source, 'Explicit')
  const path = join(project.dir, 'content/post.md')
  deepEqual(value.observed, [
    { phase: 'parse', path, cwd: join(project.dir, 'content'), value: '# Explicit', history: [path] },
    { phase: 'transform', path: '/parse-moved.md' },
    { phase: 'emit', path: '/transform-moved.md', history: [path, '/parse-moved.md', '/transform-moved.md'], private: '# Explicit' }
  ])
  equal(result.diagnostics.length, 1)
  deepEqual(result.diagnostics[0]!.provenance, {
    scope: 'record',
    collection: { order: 0, id: 'posts' },
    source: { path: 'post.md' },
    record: { id: 'post.md#', index: 0 }
  })
})

test('content record: equal-looking definitions are independent while aliases share ordinary generated work', async t => {
  const project = await contentProject(
    t,
    `import {content,defineConfig,s} from 'velite'
let parses=0,runs=0
function label(){const parse=this.parser;this.parser=(text,file)=>{file.data.label=++parses;return (parse(text,file))};return (tree,file)=>{runs++;tree.children[0].children[0].value+=' '+file.data.label}}
const options={remarkPlugins:[label]},a=content.markdown(options),alias=a,b=content.markdown(options)
export default defineConfig({collections:{posts:{pattern:'*.md',schema:s.object({a:a.html(),alias:alias.html(),b:b.html()}).transform(value=>({...value,parses,runs}))}}})`,
    { 'post.md': '# Same' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const value = result.output.collections.posts!.entries[0]!.data as { a: string; alias: string; b: string; parses: number; runs: number }
  equal(value.a, value.alias)
  deepEqual([value.parses, value.runs], [2, 2])
  ok(value.a !== value.b)
  match(value.a, /id="same-/)
  match(value.b, /id="same-/)
})

test('content record: source-only initialization tolerates plugin-owned host values without a clone eligibility policy', async t => {
  const project = await contentProject(
    t,
    `import {content,defineConfig,s} from 'velite'
function opaque(){const cycle={};cycle.self=cycle;this.data('opaque',{map:new Map(),weak:new WeakMap(),symbol:Symbol(),fn:()=>{},cycle});const parse=this.parser;this.parser=(text,file)=>{file.data.opaque=this.data('opaque');return parse(text,file)};return()=>{throw new Error('source-only must not run')}}
const doc=content.markdown({remarkPlugins:[opaque]})
export default defineConfig({collections:{posts:{pattern:'*.md',schema:s.object({excerpt:doc.excerpt(),metadata:doc.metadata()})}}})`,
    { 'post.md': 'Crème 茶' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, { excerpt: 'Crème 茶', metadata: { readingTime: 1, wordCount: 1.56 } })
})
