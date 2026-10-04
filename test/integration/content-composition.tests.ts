import { deepEqual, equal, match, rejects } from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

test('content: shared warnings do not choose the first requesting field or object key order', async t => {
  const outcomes: unknown[] = []
  for (const reverse of [false, true]) {
    const project = await contentProject(
      t,
      `import {content,defineConfig,s} from 'velite'
const warn=message=>function(){return (_tree,file)=>{file.message(message)}}
const z=content.markdown({remarkPlugins:[warn('z warning')]}),a=content.markdown({remarkPlugins:[warn('a warning')]})
export default defineConfig({collections:{posts:{pattern:'*.md',schema:s.object({${reverse ? 'a:a.html(),z:z.html()' : 'z:z.html(),a:a.html()'}})}}})`,
      { 'post.md': '# Source' }
    )
    const result = await project.build()
    equal(result.diagnostics.length, 2)
    for (const issue of result.diagnostics)
      deepEqual(issue.provenance, { scope: 'record', collection: { order: 0, id: 'posts' }, source: { path: 'post.md' }, record: { id: 'post.md#', index: 0 } })
    outcomes.push(result.diagnostics)
  }
  deepEqual(outcomes[0], outcomes[1])
})

test('content: concurrent and late TOC/items/metadata deliveries are mutation-isolated for both dialects', async t => {
  for (const dialect of ['markdown', 'mdx'])
    await t.test(dialect, async t => {
      const ext = dialect === 'mdx' ? 'mdx' : 'md',
        primary = dialect === 'mdx' ? 'code' : 'html'
      const project = await contentProject(
        t,
        `import {content,defineConfig,s} from 'velite'
const doc=content.${dialect}({minify:false})
export default defineConfig({collections:{posts:{pattern:'*.${ext}',schema:s.object({mutated:doc.toc().transform(items=>{items[0].title='Changed';items[0].id='bad';items.push({depth:6,title:'Invented',id:'fake'});return items}),normal:doc.toc(),mutatedMeta:doc.metadata().transform(value=>{value.wordCount=-999;return value}),normalMeta:doc.metadata()}).transform(async value=>({...value,late:await doc.toc().parseAsync(undefined),lateMeta:await doc.metadata().parseAsync(undefined),primary:await doc.${primary}().parseAsync(undefined)}))}}})`,
        { ['post.' + ext]: '# Source' }
      )
      const result = await project.build(),
        value = result.output.collections.posts!.entries[0]!.data as Record<string, unknown>
      deepEqual(result.diagnostics, [])
      deepEqual(value.mutated, [
        { depth: 1, title: 'Changed', id: 'bad' },
        { depth: 6, title: 'Invented', id: 'fake' }
      ])
      deepEqual(value.normal, [{ depth: 1, title: 'Source', id: 'source' }])
      deepEqual(value.late, value.normal)
      deepEqual(value.mutatedMeta, { readingTime: 1, wordCount: -999 })
      deepEqual(value.normalMeta, { readingTime: 1, wordCount: 1 })
      deepEqual(value.lateMeta, value.normalMeta)
      match(value.primary as string, /source/)
    })
})

test('content: native optional discarded output still requests stages and retains successful asset effects', async t => {
  const project = await contentProject(
    t,
    `import {content,defineConfig,s} from 'velite'
let runs=0
function observe(){return ()=>{runs++}}
const doc=content.markdown({remarkPlugins:[observe]})
export default defineConfig({output:{name:'[name].[ext]'},collections:{posts:{pattern:'*.md',schema:s.object({discarded:doc.html().optional()}).transform(value=>({...value,runs}))}}})`,
    { 'post.md': '# Source\n\n[Asset](./asset.txt)', 'asset.txt': 'asset' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, { runs: 1 })
  deepEqual(await readdir(join(project.dir, 'public/static')), ['asset.txt'])
})

test('content: normal preprocessing, wrappers/unions, refinements/pipes, and black-box async schemas compose natively', async t => {
  const project = await contentProject(
    t,
    `import {content,context,defineConfig,s} from 'velite'
let parses=0
function observe(){const parse=this.parser;this.parser=(...args)=>{parses++;return parse(...args)}}
const doc=content.markdown({remarkPlugins:[observe]})
export default defineConfig({collections:{posts:{pattern:'*.json',schema:s.object({conditional:s.preprocess(value=>value??context().file.content??null,doc.excerpt().nullable()),union:s.union([doc.excerpt(),s.number().transform(value=>'number '+value)]),text:doc.excerpt().refine(text=>text==='Explicit').pipe(s.string().transform(text=>text.toLowerCase())),prefault:doc.excerpt().prefault('Explicit'),default:doc.excerpt().default('output default'),custom:s.any().transform(async()=>doc.metadata().parseAsync('Explicit'))}).transform(value=>({...value,parses}))}}})`,
    { 'post.json': JSON.stringify({ union: 7, text: 'Explicit', custom: null }) }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, {
    conditional: null,
    union: 'number 7',
    text: 'explicit',
    prefault: 'Explicit',
    default: 'output default',
    custom: { readingTime: 1, wordCount: 1 },
    parses: 1
  })
})

test('content: every selection follows the retained Parse/Transform/Emit failure matrix for both dialects', async t => {
  for (const dialect of ['markdown', 'mdx'])
    for (const phase of ['parse', 'transform', 'emit'])
      await t.test(dialect + ' ' + phase, async t => {
        const ext = dialect === 'mdx' ? 'mdx' : 'md',
          primary = dialect === 'mdx' ? 'code' : 'html'
        const project = await contentProject(
          t,
          `import {content,defineConfig,s} from 'velite'
let failures=0
function fail(){const processor=this;if('${phase}'==='parse'){processor.parser=()=>{failures++;throw new Error('parse failure')};return}return ()=>{if('${phase}'==='transform'){failures++;throw new Error('transform failure')}processor.compiler=()=>{failures++;throw new Error('emit failure')}}}
const doc=content.${dialect}({minify:false,remarkPlugins:[fail]})
export default defineConfig({collections:{posts:{pattern:'*.${ext}',schema:s.object({primary:doc.${primary}().catch('fallback'),again:doc.${primary}().catch('again'),toc:doc.toc().catch([]),excerpt:doc.excerpt().catch('missing'),metadata:doc.metadata().catch({readingTime:9,wordCount:-1})}).transform(value=>({...value,failures}))}}})`,
          { ['post.' + ext]: '# Source' }
        )
        const result = await project.build()
        deepEqual(result.diagnostics, [])
        deepEqual(result.output.collections.posts!.entries[0]!.data, {
          primary: 'fallback',
          again: 'again',
          toc: phase === 'emit' ? [{ depth: 1, title: 'Source', id: 'source' }] : [],
          excerpt: phase === 'parse' ? 'missing' : 'Source',
          metadata: phase === 'parse' ? { readingTime: 9, wordCount: -1 } : { readingTime: 1, wordCount: 1 },
          failures: 1
        })
      })
})

test('content: native catch cannot conceal a directly thrown content invariant', async t => {
  const project = await contentProject(
    t,
    `import {content,defineConfig,s,VeliteError} from 'velite'
function invariant(){return ()=>{throw new VeliteError('internal',{message:'intentional invariant'})}}
const doc=content.markdown({remarkPlugins:[invariant]})
export default defineConfig({collections:{posts:{pattern:'*.md',schema:s.object({html:doc.html().catch('not allowed')})}}})`,
    { 'post.md': '# Source' }
  )
  await rejects(project.build(), error => error instanceof project.api.VeliteError && error.code === 'internal' && error.message === 'intentional invariant')
})
