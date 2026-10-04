import { deepEqual, equal } from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

test('content: HTML resumes one opaque stateful processor and late source stays pre-transform', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
let parses=0, runs=0, emits=0
function stateful() {
 const parse=this.parser, privateState=new Map(), symbol=Symbol('private'); const cyclic={}; cyclic.self=cyclic; privateState.set(symbol,cyclic)
 this.parser=(text,file)=>{ parses++; privateState.set('file',file); return parse(text,file) }
 return tree=>{ runs++; if(privateState.get('file')===undefined || privateState.get(symbol).self!==cyclic) throw new Error('lost closure'); tree.children[0].children[0].value='Changed' }
}
function compiler() { const processor=this; return () => { const emit=processor.compiler; processor.compiler=(tree,file)=>{ emits++; return emit(tree,file) } } }
const doc=content.markdown({ remarkPlugins:[stateful], rehypePlugins:[compiler] })
export default defineConfig({ collections:{ posts:{ pattern:'*.md', schema:s.object({ a:doc.html(), b:doc.html() }).transform(async value=>({...value, text:await doc.excerpt().parseAsync(undefined), meta:await doc.metadata().parseAsync(undefined), parses,runs,emits })) } } })`,
    { 'post.md': '# Original\n\nBody' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const value = result.output.collections.posts!.entries[0]!.data as Record<string, unknown>
  equal(value.a, '<h1 id="changed">Changed</h1>\n<p>Body</p>')
  deepEqual(value, { a: value.a, b: value.a, text: 'Original Body', meta: { readingTime: 1, wordCount: 2 }, parses: 1, runs: 1, emits: 1 })
})

test('content: callback replacement file reaches compiler and final mutated messages have record ownership', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
function replace() { return (tree,file,next) => { const replacement = new file.constructor({path:'/replacement.md',value:'replacement value'}); replacement.result={marker:'private result'}; replacement.message('provisional'); next(undefined,{ type:'root', children:[{type:'paragraph',children:[{type:'text',value:'Replacement'}]}] },replacement) } }
function compiler() { const processor=this; return (_tree,file) => { file.messages[0].reason='final transform warning'; const emit=processor.compiler; processor.compiler=(tree,finalFile)=>{ if(finalFile!==file || finalFile.path!=='/replacement.md' || finalFile.value!=='replacement value' || finalFile.result.marker!=='private result') throw new Error('lost final file'); finalFile.message('compiler warning'); return emit(tree,finalFile) } } }
const doc=content.markdown({remarkPlugins:[replace],rehypePlugins:[compiler]})
export default defineConfig({collections:{posts:{pattern:'*.md',schema:s.object({html:doc.html(),again:doc.html()}).transform(async value=>({...value,source:await doc.excerpt().parseAsync(undefined)}))}}})`,
    { 'post.md': '# Original' }
  )
  const result = await project.build()
  deepEqual(result.output.collections.posts!.entries[0]!.data, { html: '<p>Replacement</p>', again: '<p>Replacement</p>', source: 'Original' })
  deepEqual(
    result.diagnostics.map(message => message.message),
    ['compiler warning', 'final transform warning']
  )
  for (const message of result.diagnostics)
    deepEqual(message.provenance, { scope: 'record', collection: { order: 0, id: 'posts' }, source: { path: 'post.md' }, record: { id: 'post.md#', index: 0 } })
})

test('content: recovered later failures retain only successful stage effects and never retry', async t => {
  const project = await contentProject(
    t,
    `import { content, context, defineConfig, s } from 'velite'
let transforms=0, emits=0
const declare=(collect,source)=>collect({type:'asset',owner:context().record.id,assetPath:context().project.root+'/'+source,publicUrl:'/static/'+source,resolved:true,isImage:false})
function failsTransform() { const collect=context().collectEffect; declare(collect,'parse.txt'); return (_tree,_file,next)=>{ transforms++; Promise.resolve().then(()=>{declare(collect,'failed-transform.txt');next(new Error('transform failure'))}) } }
function failsEmit() { const collect=context().collectEffect, processor=this; return ()=>{ declare(collect,'transform.txt'); processor.compiler=()=>{ emits++;declare(collect,'failed-emit.txt');throw new Error('emit failure') } } }
const transform=content.markdown({remarkPlugins:[failsTransform]}), emit=content.markdown({rehypePlugins:[failsEmit]})
export default defineConfig({output:{name:'[name].[ext]'},collections:{posts:{pattern:'*.md',schema:s.object({a:transform.html().catch('transform fallback'),b:transform.html().catch('same fallback'),c:emit.html().catch('emit fallback'),d:emit.html().catch('same emit fallback')}).transform(async value=>({...value,source:await transform.excerpt().parseAsync(undefined),other:await emit.excerpt().parseAsync(undefined),transforms,emits}))}}})`,
    {
      'post.md': '# Original',
      'parse.txt': 'parse',
      'transform.txt': 'transform'
    }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, {
    a: 'transform fallback',
    b: 'same fallback',
    c: 'emit fallback',
    d: 'same emit fallback',
    source: 'Original',
    other: 'Original',
    transforms: 1,
    emits: 1
  })
  deepEqual(await readdir(join(project.dir, 'public/static')), ['parse.txt', 'transform.txt'])
})

test('content: shared failure remains field-local and invalid records discard successful lower effects', async t => {
  const project = await contentProject(
    t,
    `import { content, context, defineConfig, s } from 'velite'
function failure() { const {project,collectEffect}=context(); collectEffect({type:'asset',source:project.root+'/missing.txt',output:{base:'/static/',template:'[name].[ext]'},metadata:false},{path:[],declaration:0,occurrence:{kind:'singleton'}});return ()=>{throw new Error('shared transform failure')} }
const doc=content.markdown({remarkPlugins:[failure]})
export default defineConfig({collections:{posts:{pattern:'*.md',schema:s.object({a:doc.html(),b:doc.html(),source:doc.excerpt()})}}})`,
    { 'post.md': '# Original' }
  )
  const result = await project.build()
  deepEqual(result.output.collections.posts!.entries, [])
  deepEqual(
    result.diagnostics.map(issue => [issue.message, issue.provenance.scope === 'record' ? issue.provenance.path : undefined]),
    [
      ['shared transform failure', ['a']],
      ['shared transform failure', ['b']]
    ]
  )
})

test('content: linked assets share one transform and comment removal preserves surrounding raw HTML', async t => {
  const project = await contentProject(
    t,
    `import { content, context, defineConfig, s } from 'velite'
function once() { return ()=>context().collectEffect({type:'unique',group:'executions',value:'one'},{path:[],declaration:0,occurrence:{kind:'singleton'}}) }
const doc=content.markdown({rehypePlugins:[once]})
export default defineConfig({output:{name:'[name].[ext]'},collections:{posts:{pattern:'*.md',schema:s.object({a:doc.html(),b:doc.html()})}}})`,
    { 'post.md': '<div>before<!-- hidden -->after</div>\n\n[Download](./asset.txt)', 'asset.txt': 'asset' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const data = result.output.collections.posts!.entries[0]!.data as { a: string; b: string }
  equal(data.a, '<div>beforeafter</div>\n<p><a href="/static/asset.txt">Download</a></p>')
  equal(data.b, data.a)
  deepEqual(await readdir(join(project.dir, 'public/static')), ['asset.txt'])
})

test('content: compiler strings, byte values, and opaque results follow ordinary VFile processing', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
const files={}
function compiler(kind) { return function() { const processor=this;return ()=>{processor.compiler=(_tree,file)=>{files[kind]=file;file.value='side effect';return kind==='string'?'serialized':kind==='bytes'?new TextEncoder().encode('bytes'):{marker:'opaque'}}} } }
const string=content.markdown({rehypePlugins:[compiler('string')]}),bytes=content.markdown({rehypePlugins:[compiler('bytes')]}),opaque=content.markdown({rehypePlugins:[compiler('opaque')]})
export default defineConfig({collections:{posts:{pattern:'*.md',schema:s.object({string:string.html(),bytes:bytes.html(),opaque:opaque.html()}).transform(value=>({...value,values:Object.fromEntries(Object.entries(files).map(([key,file])=>[key,String(file)])),result:files.opaque.result.marker}))}}})`,
    { 'post.md': 'Source' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, {
    string: 'serialized',
    bytes: 'bytes',
    opaque: 'side effect',
    values: { string: 'serialized', bytes: 'bytes', opaque: 'side effect' },
    result: 'opaque'
  })
})
