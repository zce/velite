import { deepEqual, equal, match } from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

test('content: MDX code and late static source share the real processor without evaluating code', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
let parses=0,runs=0,recmas=0,emits=0
function stateful(){const parse=this.parser,privateState=new WeakMap();this.parser=(text,file)=>{parses++;privateState.set(file,{marker:'owned'});return parse(text,file)};return (tree,file)=>{runs++;if(privateState.get(file).marker!=='owned')throw new Error('lost state');tree.children.find(node=>node.type==='heading').children[0].value='Changed'}}
function recma(){const processor=this;return ()=>{recmas++;const emit=processor.compiler;processor.compiler=(tree,file)=>{emits++;return emit(tree,file)}}}
const doc=content.mdx({minify:false,remarkPlugins:[stateful],recmaPlugins:[recma]})
export default defineConfig({collections:{posts:{pattern:'*.mdx',schema:s.object({a:doc.code(),b:doc.code()}).transform(async value=>({...value,source:await doc.excerpt().parseAsync(undefined),meta:await doc.metadata().parseAsync(undefined),parses,runs,recmas,emits}))}}})`,
    {
      'post.mdx':
        "import Never from 'never-load-this-module'\n\nexport const danger = (() => { throw new Error('must not execute') })()\n\n# Original\n\n<Panel title=\"excluded\">Hello <strong>茶</strong> `inline` {danger}</Panel>\n\n{/* excluded comment */}\n\n```js\nexcluded code\n```"
    }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const value = result.output.collections.posts!.entries[0]!.data as {
    a: string
    b: string
    source: string
    meta: unknown
    parses: number
    runs: number
    recmas: number
    emits: number
  }
  equal(value.b, value.a)
  match(value.a, /Changed/)
  match(value.a, /never-load-this-module/)
  deepEqual(
    [value.source, value.meta, value.parses, value.runs, value.recmas, value.emits],
    ['Original Hello 茶 inline', { readingTime: 1, wordCount: 3.56 }, 1, 1, 1, 1]
  )
})

test('content: source-only MDX skips transformers, recma, compiler, and minification', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
let attaches=0,parses=0
function observe(){attaches++;const parse=this.parser;this.parser=(...args)=>{parses++;return parse(...args)};return ()=>{throw new Error('unexpected transform')}}
function recma(){return ()=>{throw new Error('unexpected recma')}}
const doc=content.mdx({remarkPlugins:[observe],recmaPlugins:[recma]})
export default defineConfig({collections:{posts:{pattern:'*.mdx',schema:s.object({text:doc.excerpt(),meta:doc.metadata()}).transform(value=>({...value,attaches,parses}))}}})`,
    { 'post.mdx': 'export const ignored = 123\n\n<Panel label="ignored"> A <span>B</span> {ignored} </Panel>' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, { text: 'A B', meta: { readingTime: 1, wordCount: 2 }, attaches: 1, parses: 1 })
})

test('content: MDX local/global plugin order, program/development options, and linked files work', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
const order=[]
const observe=label=>function(){return ()=>{order.push(label)}}
const doc=content.mdx({minify:false,outputFormat:'program',development:true,remarkPlugins:[observe('local remark')],rehypePlugins:[observe('local rehype')],recmaPlugins:[observe('local recma')]})
export default defineConfig({mdx:{minify:true,outputFormat:'function-body',development:false,remarkPlugins:[observe('global remark')],rehypePlugins:[observe('global rehype')],recmaPlugins:[observe('global recma')]},output:{name:'[name].[ext]'},collections:{posts:{pattern:'*.mdx',schema:s.object({code:doc.code()}).transform(value=>({...value,order}))}}})`,
    { 'post.mdx': '# Title\n\n[Asset](./asset.txt)', 'asset.txt': 'asset' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const value = result.output.collections.posts!.entries[0]!.data as { code: string; order: string[] }
  match(value.code, /export default function MDXContent/)
  match(value.code, /jsxDEV/)
  match(value.code, /\/static\/asset\.txt/)
  deepEqual(value.order, ['local remark', 'global remark', 'local rehype', 'global rehype', 'local recma', 'global recma'])
  deepEqual(await readdir(join(project.dir, 'public/static')), ['asset.txt'])
})

test('content: MDX recma and real minifier failures are retained, recovered, and stage-transactional', async t => {
  const project = await contentProject(
    t,
    `import { content, context, defineConfig, s } from 'velite'
let recmas=0,emits=0
const declare=(collect,name)=>{const p=context().project;collect({type:'asset',source:p.root+'/'+name,output:{base:p.output.base,template:p.output.name},metadata:false},{path:[],declaration:0,occurrence:{kind:'singleton'}})}
function failsRecma(){const collect=context().collectEffect;declare(collect,'parse.txt');return async ()=>{recmas++;await Promise.resolve();declare(collect,'failed-recma.txt');throw new Error('recma failure')}}
function badCompiler(){const collect=context().collectEffect,processor=this;return ()=>{declare(collect,'transform.txt');processor.compiler=()=>{emits++;declare(collect,'failed-minify.txt');return 'return ('}}}
const recma=content.mdx({recmaPlugins:[failsRecma]}),minify=content.mdx({recmaPlugins:[badCompiler]})
export default defineConfig({output:{name:'[name].[ext]'},collections:{posts:{pattern:'*.mdx',schema:s.object({a:recma.code().catch('recma fallback'),b:recma.code().catch('same recma fallback'),c:minify.code().catch('minify fallback'),d:minify.code().catch('same minify fallback')}).transform(async value=>({...value,source:await recma.excerpt().parseAsync(undefined),other:await minify.excerpt().parseAsync(undefined),recmas,emits}))}}})`,
    { 'post.mdx': '# Original', 'parse.txt': 'parse', 'transform.txt': 'transform' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, {
    a: 'recma fallback',
    b: 'same recma fallback',
    c: 'minify fallback',
    d: 'same minify fallback',
    source: 'Original',
    other: 'Original',
    recmas: 1,
    emits: 1
  })
  deepEqual(await readdir(join(project.dir, 'public/static')), ['parse.txt', 'transform.txt'])
})

test('content: MDX follows callback file replacement into recma and compiler', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
function replace(){return (tree,file,next)=>{const replacement=new file.constructor({path:'/owned.mdx',value:'replacement'});replacement.data.private=new Map([['key','retained']]);next(undefined,tree,replacement)}}
function recma(){return (_tree,file)=>{if(file.path!=='/owned.mdx'||file.value!=='replacement'||file.data.private.get('key')!=='retained')throw new Error('lost replacement');file.message('replacement warning')}}
const doc=content.mdx({minify:false,remarkPlugins:[replace],recmaPlugins:[recma]})
export default defineConfig({collections:{posts:{pattern:'*.mdx',schema:s.object({code:doc.code(),meta:doc.metadata()})}}})`,
    { 'post.mdx': '# Source' }
  )
  const result = await project.build()
  equal(result.diagnostics.length, 1)
  equal(result.diagnostics[0]!.message, 'replacement warning')
  deepEqual(result.diagnostics[0]!.provenance, {
    scope: 'record',
    collection: { order: 0, id: 'posts' },
    source: { path: 'post.mdx' },
    record: { id: 'post.mdx#', index: 0 }
  })
  match((result.output.collections.posts!.entries[0]!.data as { code: string }).code, /Source/)
})
