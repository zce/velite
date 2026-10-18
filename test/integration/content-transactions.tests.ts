import { deepEqual, equal } from 'node:assert/strict'
import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

test('content: cross-record conflicts discard every participant and its assets, preserving valid neighbors through rebuilds', async t => {
  const project = await contentProject(
    t,
    `import {content,context,defineConfig,s} from 'velite'
function unique(){return async (_tree,file)=>{await Promise.resolve();context().collectEffect({type:'unique',group:'headings',value:String(file).split('\\n')[0]},{path:[],declaration:0,occurrence:{kind:'singleton'}})}}
const doc=content.markdown({remarkPlugins:[unique]})
export default defineConfig({output:{name:'[name].[ext]'},collections:{posts:{pattern:'*.md',schema:s.object({toc:doc.toc(),html:doc.html(),again:doc.html()})}}})`,
    {
      'a.md': '# Shared\n\n[Asset](./a.txt)',
      'b.md': '# Shared\n\n[Asset](./b.txt)',
      'c.md': '# Neighbor\n\n[Asset](./c.txt)',
      'a.txt': 'a',
      'b.txt': 'b',
      'c.txt': 'c'
    }
  )
  const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
  t.after(() => instance.dispose())
  const first = await instance.build({ layout: 'single' })
  deepEqual(
    first.output.collections.posts!.entries.map(entry => entry.id),
    ['c.md#']
  )
  equal(first.diagnostics.length, 2)
  deepEqual(first.diagnostics.map(issue => (issue.provenance.scope === 'record' ? issue.provenance.record.id : undefined)).sort(), ['a.md#', 'b.md#'])
  deepEqual(await readdir(join(project.dir, 'public/static')), ['c.txt'])
  const source = join(project.dir, 'content/b.md')
  await writeFile(source, '# Distinct\n\n[Asset](./b.txt)')
  const recovered = await instance.apply([{ type: 'change', absPath: source }])
  deepEqual(recovered!.diagnostics, [])
  equal(recovered!.output.collections.posts!.entries.length, 3)
  deepEqual(await readdir(join(project.dir, 'public/static')), ['a.txt', 'b.txt', 'c.txt'])
  await writeFile(source, '# Shared\n\n[Asset](./b.txt)')
  const invalid = await instance.apply([{ type: 'change', absPath: source }])
  deepEqual(invalid!.output, first.output)
  deepEqual(invalid!.diagnostics, first.diagnostics)
  deepEqual(await readdir(join(project.dir, 'public/static')), ['c.txt'])
  const full = await project.build()
  deepEqual(full.output, invalid!.output)
  deepEqual(full.diagnostics, invalid!.diagnostics)
})

test('content: collection identity separates equal record IDs in uniqueness and incremental asset ownership', async t => {
  const conflict = await contentProject(
    t,
    `import {defineConfig,s} from 'velite'
export default defineConfig({collections:{a:{pattern:'*.json',schema:s.object({slug:s.unique('shared')})},b:{pattern:'*.json',schema:s.object({slug:s.unique('shared')})}}})`,
    { 'records.json': JSON.stringify([{ slug: 'one' }]) }
  )
  const failed = await conflict.build()
  equal(failed.diagnostics.length, 2)
  deepEqual(
    Object.values(failed.output.collections).map(col => col.entries.length),
    [0, 0]
  )
  deepEqual(
    failed.diagnostics.map(issue => (issue.provenance.scope === 'record' ? issue.provenance.collection.id : undefined)),
    ['a', 'b']
  )
  const project = await contentProject(
    t,
    `import {content,defineConfig,s} from 'velite'
const doc=content.markdown()
export default defineConfig({output:{name:'[name].[ext]'},collections:{a:{pattern:'*.json',schema:s.object({a:doc.html()})},b:{pattern:'*.json',schema:s.object({b:doc.html()})}}})`,
    { 'records.json': JSON.stringify([{ a: '[A](./a.txt)', b: '[B](./b.txt)' }]), 'a.txt': 'a', 'b.txt': 'b', 'new.txt': 'new' }
  )
  const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
  t.after(() => instance.dispose())
  const first = await instance.build({ layout: 'single' })
  deepEqual(first.diagnostics, [])
  deepEqual(await readdir(join(project.dir, 'public/static')), ['a.txt', 'b.txt'])
  const source = join(project.dir, 'content/records.json')
  await writeFile(source, JSON.stringify([{ a: '[A](./new.txt)', b: '[B](./b.txt)' }]))
  const result = await instance.apply([{ type: 'change', absPath: source }])
  deepEqual(result!.diagnostics, [])
  deepEqual(await readdir(join(project.dir, 'public/static')), ['b.txt', 'new.txt'])
  const full = await project.build()
  deepEqual(result!.output, full.output)
})
