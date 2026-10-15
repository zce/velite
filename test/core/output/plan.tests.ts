import assert from 'node:assert/strict'
import { test } from 'node:test'

import { planEntry, planSingleCollection, planSplitCollectionEntry, planSplitOutput, planWrites } from '../../../src/core/output/plan'

import type { CollectionResult } from '../../../src/core/model'
import type { CollectionMeta } from '../../../src/core/output/declaration'
import type { LogicalOutput } from '../../../src/core/output/logical'
import type { PlanWritesInput } from '../../../src/core/output/plan'

const meta = (name: string, typeName: string, single: boolean): CollectionMeta => ({ name, typeName, single })

const list = (name: string, entries: Array<{ id: string; data: unknown }>): CollectionResult => ({
  collection: name,
  mode: 'list',
  entries: entries.map(e => ({ id: e.id, source: e.id.split('#')[0]!, data: e.data }))
})

const single = (name: string, entries: Array<{ id: string; data: unknown }>): CollectionResult => ({
  collection: name,
  mode: 'single',
  entries: entries.map(e => ({ id: e.id, source: e.id.split('#')[0]!, data: e.data }))
})

const output = (collections: CollectionResult[]): LogicalOutput => ({
  collections: Object.fromEntries(collections.map(c => [c.collection, c]))
})

const input = (out: LogicalOutput, collections: CollectionMeta[], format: 'esm' | 'cjs' = 'esm'): PlanWritesInput => ({
  output: out,
  collections,
  format,
  configRelPath: '../velite.config.ts',
  pretty: true
})

test('planSplitOutput: produces one record write per entry with identity-based paths', () => {
  const writes = planSplitOutput(
    'posts',
    [
      { id: 'posts/a.md#default', data: { a: 1 } },
      { id: 'posts/b.md#default', data: { b: 2 } }
    ],
    true
  )
  assert.equal(writes.length, 2)
  assert.ok(writes.every(w => w.kind === 'record'))
  assert.ok(writes[0]!.path.startsWith('records/posts/'))
  assert.ok(writes[0]!.path.endsWith('.json'))
  assert.notEqual(writes[0]!.path, writes[1]!.path)
  assert.deepEqual(JSON.parse(writes[0]!.content), { a: 1 })
})

test('planSplitOutput: record paths are stable across content-only changes', () => {
  const first = planSplitOutput('posts', [{ id: 'posts/a.md#default', data: { a: 1 } }], true)
  const second = planSplitOutput('posts', [{ id: 'posts/a.md#default', data: { a: 2 } }], true)
  assert.equal(first[0]!.path, second[0]!.path)
  assert.deepEqual(JSON.parse(second[0]!.content), { a: 2 })
})

test('planSingleCollection: one collection write at {key}.json', () => {
  const write = planSingleCollection('posts', [{ a: 1 }], true)
  assert.equal(write.kind, 'collection')
  assert.equal(write.path, 'posts.json')
  assert.deepEqual(JSON.parse(write.content), [{ a: 1 }])
})

test('planEntry: single layout re-exports {key}.json with json import attribute (esm)', () => {
  const write = planEntry([meta('posts', 'Post', false)], 'esm', false)
  assert.equal(write.kind, 'entry')
  assert.equal(write.path, 'index.js')
  assert.ok(write.content.includes("export { default as posts } from './posts.json' with { type: 'json' }"))
})

test('planEntry: split layout re-exports collections/{key}.js (esm)', () => {
  const write = planEntry([meta('posts', 'Post', false)], 'esm', true)
  assert.ok(write.content.includes("export { default as posts } from './collections/posts.js'"))
  assert.ok(!write.content.includes("type: 'json'"))
})

test('planEntry: cjs uses require/exports', () => {
  const write = planEntry([meta('posts', 'Post', false)], 'cjs', false)
  assert.ok(write.content.includes("exports.posts = require('./posts.json')"))
})

test('planSplitCollectionEntry: list collection imports records and exports an array', () => {
  const write = planSplitCollectionEntry(meta('posts', 'Post', false), ['records/posts/a.x.json', 'records/posts/b.y.json'], 'esm')
  assert.equal(write.path, 'collections/posts.js')
  assert.ok(write.content.includes("import r0 from '../records/posts/a.x.json' with { type: 'json' }"))
  assert.ok(write.content.includes('export default [r0, r1]'))
})

test('planSplitCollectionEntry: single collection exports the first record (or undefined when empty)', () => {
  const filled = planSplitCollectionEntry(meta('site', 'Site', true), ['records/site/site.z.json'], 'esm')
  assert.ok(filled.content.includes('export default r0'))
  const empty = planSplitCollectionEntry(meta('site', 'Site', true), [], 'esm')
  assert.ok(empty.content.includes('export default undefined'))
})

test('planSplitCollectionEntry: cjs uses require + module.exports', () => {
  const write = planSplitCollectionEntry(meta('posts', 'Post', false), ['records/posts/a.x.json'], 'cjs')
  assert.ok(write.content.includes("const r0 = require('../records/posts/a.x.json')"))
  assert.ok(write.content.includes('module.exports = [r0]'))
})

test('planWrites: split layout produces record files + collection entries + entry + types', () => {
  const out = output([list('posts', [{ id: 'posts/a.md#default', data: { a: 1 } }])])
  const writes = planWrites(input(out, [meta('posts', 'Post', false)]), true)
  const kinds = writes.map(w => w.kind)
  assert.ok(kinds.includes('record'))
  assert.ok(kinds.includes('collection')) // the collections/posts.js entry
  assert.ok(kinds.includes('entry'))
  assert.ok(kinds.includes('type'))
  assert.ok(writes.some(w => w.path.startsWith('records/posts/')))
  assert.ok(writes.some(w => w.path === 'collections/posts.js'))
  assert.ok(writes.some(w => w.path === 'index.js'))
  assert.ok(writes.some(w => w.path === 'index.d.ts'))
})

test('planWrites: single layout produces one {key}.json per collection + entry + types (no record files)', () => {
  const out = output([list('posts', [{ id: 'posts/a.md#default', data: { a: 1 } }]), single('site', [{ id: 'site.yml#default', data: { name: 'x' } }])])
  const writes = planWrites(input(out, [meta('posts', 'Post', false), meta('site', 'Site', true)]), false)
  assert.ok(writes.some(w => w.path === 'posts.json' && w.kind === 'collection'))
  assert.ok(writes.some(w => w.path === 'site.json' && w.kind === 'collection'))
  assert.ok(writes.some(w => w.path === 'index.js'))
  assert.ok(writes.some(w => w.path === 'index.d.ts'))
  // No split record files in the single layout.
  assert.ok(!writes.some(w => w.path.startsWith('records/')))
  assert.ok(!writes.some(w => w.path.startsWith('collections/')))
  // Single collection data is the scalar value, not an array.
  const siteWrite = writes.find(w => w.path === 'site.json')!
  assert.deepEqual(JSON.parse(siteWrite.content), { name: 'x' })
})

test('planWrites: single layout empty single collection yields null data', () => {
  const out = output([single('cfg', [])])
  const writes = planWrites(input(out, [meta('cfg', 'Cfg', true)]), false)
  const cfg = writes.find(w => w.path === 'cfg.json')!
  assert.equal(JSON.parse(cfg.content), null)
})

test('planWrites: pretty flag minifies JSON when false', () => {
  const out = output([list('posts', [{ id: 'posts/a.md#default', data: { a: 1 } }])])
  const pretty = planWrites(input(out, [meta('posts', 'Post', false)]), false)
  const minified = planWrites({ ...input(out, [meta('posts', 'Post', false)]), pretty: false }, false)
  const prettyContent = pretty.find(w => w.path === 'posts.json')!.content
  const minifiedContent = minified.find(w => w.path === 'posts.json')!.content
  assert.ok(prettyContent.includes('\n'))
  assert.ok(!minifiedContent.includes('\n'))
  assert.ok(minifiedContent.length < prettyContent.length)
})
