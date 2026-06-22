import assert from 'node:assert/strict'
import { test } from 'node:test'

import { emptyManifest } from '../../../src/core/output/manifest'
import { writeOutput } from '../../../src/core/output/writer'
import { posix } from '../../../src/core/util/path'

import type { CollectionResult } from '../../../src/core/model'
import type { CollectionMeta } from '../../../src/core/output/declaration'
import type { LogicalOutput } from '../../../src/core/output/logical'
import type { FileSystem } from '../../../src/runtime/fs'

/** Minimal in-memory FileSystem for writer tests. */
const createMemoryFs = () => {
  const files = new Map<string, Uint8Array>()
  let writeCount = 0
  let removeCount = 0
  const fs: FileSystem = {
    read: async p => {
      const f = files.get(p)
      if (f === undefined) throw new Error(`ENOENT: ${p}`)
      return f
    },
    stat: async p => ({ mtimeMs: 0, size: files.get(p)?.byteLength ?? 0 }),
    walk: async () => [...files.keys()],
    write: async (p, data) => {
      writeCount++
      files.set(p, data)
    },
    remove: async p => {
      removeCount++
      files.delete(p)
    }
  }
  return { fs, files, writeCount: () => writeCount, removeCount: () => removeCount }
}

const list = (name: string, entries: unknown[]): CollectionResult => ({
  collection: name,
  mode: 'list',
  entries: entries.map((data, i) => ({ id: `${name}/${i}#default`, source: `${name}/${i}`, data }))
})

const single = (name: string, data: unknown): CollectionResult => ({
  collection: name,
  mode: 'single',
  entries: data === null ? [] : [{ id: `${name}#default`, source: `${name}`, data }]
})

const output = (collections: CollectionResult[]): LogicalOutput => ({
  collections: Object.fromEntries(collections.map(c => [c.collection, c]))
})

/** Derive CollectionMeta (typeName defaults to the collection name) from an output. */
const meta = (out: LogicalOutput): CollectionMeta[] =>
  Object.values(out.collections).map(c => ({ name: c.collection, typeName: c.collection, single: c.mode === 'single' }))

const singleDeps = (mem: ReturnType<typeof createMemoryFs>, out: LogicalOutput) => ({
  fs: mem.fs,
  path: posix,
  dir: '/out',
  layout: 'single' as const,
  configPath: '/proj/velite.config.ts',
  collections: meta(out),
  format: 'esm' as const
})

const decode = (bytes: Uint8Array | undefined): unknown => (bytes === undefined ? undefined : JSON.parse(new TextDecoder().decode(bytes)))

test('single layout: writes {name}.json for each list collection, plus index.js + index.d.ts', async () => {
  const mem = createMemoryFs()
  const out = output([list('posts', [{ title: 'a' }, { title: 'b' }])])
  const result = await writeOutput(out, singleDeps(mem, out))
  assert.deepEqual(decode(mem.files.get('/out/posts.json')), [{ title: 'a' }, { title: 'b' }])
  assert.ok(mem.files.has('/out/index.js'))
  assert.ok(mem.files.has('/out/index.d.ts'))
  assert.deepEqual(result.written.sort(), ['/out/index.d.ts', '/out/index.js', '/out/posts.json'].sort())
})

test('single layout: writes a single collection as its first entry data', async () => {
  const mem = createMemoryFs()
  const out = output([single('site', { name: 'velite' })])
  await writeOutput(out, singleDeps(mem, out))
  assert.deepEqual(decode(mem.files.get('/out/site.json')), { name: 'velite' })
})

test('single layout: writes null for an empty single collection', async () => {
  const mem = createMemoryFs()
  const out = output([single('cfg', null)])
  await writeOutput(out, singleDeps(mem, out))
  assert.equal(decode(mem.files.get('/out/cfg.json')), null)
})

test('single layout: returns written list and a manifest with digests for every file', async () => {
  const mem = createMemoryFs()
  const out = output([list('posts', [{ a: 1 }])])
  const result = await writeOutput(out, singleDeps(mem, out))
  assert.equal(result.written.length, 3)
  assert.deepEqual(Object.keys(result.manifest.files).sort(), ['/out/index.d.ts', '/out/index.js', '/out/posts.json'].sort())
  assert.equal(typeof result.manifest.files['/out/posts.json'], 'string')
})

test('single layout: skips unchanged files (same digest) on a second run', async () => {
  const mem = createMemoryFs()
  const out = output([list('posts', [{ a: 1 }])])
  const deps = singleDeps(mem, out)
  const first = await writeOutput(out, deps)
  const firstWriteCount = mem.writeCount()
  assert.equal(first.written.length, 3)
  // Second run with identical output and previous manifest: nothing rewritten.
  const second = await writeOutput(out, deps, first.manifest)
  assert.deepEqual(second.written, [])
  assert.equal(mem.writeCount(), firstWriteCount)
})

test('single layout: rewrites a file whose content changed', async () => {
  const mem = createMemoryFs()
  const deps = singleDeps(mem, output([list('posts', [{ a: 1 }])]))
  const first = await writeOutput(output([list('posts', [{ a: 1 }])]), deps)
  // posts.json content changes → rewritten; index.js / index.d.ts unchanged → skipped.
  const second = await writeOutput(output([list('posts', [{ a: 2 }])]), deps, first.manifest)
  assert.ok(second.written.includes('/out/posts.json'))
  assert.deepEqual(decode(mem.files.get('/out/posts.json')), [{ a: 2 }])
})

test('single layout: deletes stale data files present in previous manifest but not in output', async () => {
  const mem = createMemoryFs()
  const deps = singleDeps(mem, output([list('posts', [{ a: 1 }])]))
  // Seed: two collections.
  const first = await writeOutput(output([list('posts', [{ a: 1 }]), list('tags', [{ t: 'x' }])]), {
    ...deps,
    collections: meta(output([list('posts', [{ a: 1 }]), list('tags', [{ t: 'x' }])]))
  })
  assert.equal(mem.files.has('/out/tags.json'), true)
  // Next run drops the "tags" collection; its file should be removed.
  const second = await writeOutput(output([list('posts', [{ a: 1 }])]), deps, first.manifest)
  assert.equal(mem.files.has('/out/tags.json'), false)
  assert.equal(mem.removeCount(), 1)
})

test('single layout: fresh build (empty previous manifest) writes everything', async () => {
  const mem = createMemoryFs()
  const out = output([list('a', [1]), list('b', [2])])
  const result = await writeOutput(out, singleDeps(mem, out))
  // 2 data + entry + types
  assert.equal(result.written.length, 4)
  assert.equal(mem.removeCount(), 0)
})

test('single layout: cjs entry module uses require/exports', async () => {
  const mem = createMemoryFs()
  const out = output([list('posts', [{ a: 1 }])])
  await writeOutput(out, { ...singleDeps(mem, out), format: 'cjs' })
  const entry = new TextDecoder().decode(mem.files.get('/out/index.js')!)
  assert.ok(entry.includes("exports.posts = require('./posts.json')"))
})

test('single layout: index.d.ts references the user config and Infer', async () => {
  const mem = createMemoryFs()
  const out = output([list('posts', [{ a: 1 }]), single('site', { name: 'x' })])
  await writeOutput(out, singleDeps(mem, out))
  const types = new TextDecoder().decode(mem.files.get('/out/index.d.ts')!)
  assert.ok(types.includes("import type __vc from '../proj/velite.config.ts'"), types)
  assert.ok(types.includes("import type { Infer } from 'velite'"))
  assert.ok(types.includes("export type posts = Infer<Collections['posts']['schema']>"))
  assert.ok(types.includes('export declare const posts: posts[]'))
  assert.ok(types.includes('export declare const site: site'))
})

test('split layout: writes record files + collections/{name}.js + index.js + index.d.ts', async () => {
  const mem = createMemoryFs()
  const out = output([list('posts', [{ title: 'a' }, { title: 'b' }])])
  const result = await writeOutput(out, { ...singleDeps(mem, out), layout: 'split' })
  // Two record files, one collection entry, one entry module, one type declaration.
  assert.equal(result.written.length, 5)
  const recordFiles = result.written.filter(p => p.startsWith('/out/records/posts/'))
  assert.equal(recordFiles.length, 2)
  assert.ok(mem.files.has('/out/collections/posts.js'))
  assert.ok(mem.files.has('/out/index.js'))
  assert.ok(mem.files.has('/out/index.d.ts'))
  // The collection entry re-exports the record files as a default array.
  const entry = new TextDecoder().decode(mem.files.get('/out/collections/posts.js')!)
  assert.ok(entry.includes("import r0 from '../records/posts/"))
  assert.ok(entry.includes('export default [r0, r1]'))
})

test('split layout: record file paths are stable across content-only changes', async () => {
  const mem = createMemoryFs()
  const deps = { ...singleDeps(mem, output([list('posts', [{ title: 'a' }])])), layout: 'split' as const }
  const first = await writeOutput(output([list('posts', [{ title: 'a' }])]), deps)
  const firstRecord = first.written.find(p => p.startsWith('/out/records/posts/'))!
  const second = await writeOutput(output([list('posts', [{ title: 'b' }])]), deps, first.manifest)
  const secondRecord = second.written.find(p => p.startsWith('/out/records/posts/'))!
  // Same identity → same path; content changed so it is rewritten.
  assert.equal(firstRecord, secondRecord)
  assert.deepEqual(decode(mem.files.get(firstRecord)), { title: 'b' })
})

test('split layout: single collection with no entries exports undefined', async () => {
  const mem = createMemoryFs()
  const out = output([single('cfg', null)])
  await writeOutput(out, { ...singleDeps(mem, out), layout: 'split' })
  const entry = new TextDecoder().decode(mem.files.get('/out/collections/cfg.js')!)
  assert.ok(entry.includes('export default undefined'))
})

test('split layout: deletes stale record files when a record is removed', async () => {
  const mem = createMemoryFs()
  const deps = { ...singleDeps(mem, output([list('posts', [{ a: 1 }])])), layout: 'split' as const }
  const first = await writeOutput(output([list('posts', [{ a: 1 }, { b: 2 }])]), deps)
  assert.equal(first.written.filter(p => p.startsWith('/out/records/posts/')).length, 2)
  // Second run keeps the posts/0 record (content changed → rewritten) and drops posts/1 (stale).
  const second = await writeOutput(output([list('posts', [{ a: 9 }])]), deps, first.manifest)
  const remaining = [...mem.files.keys()].filter(p => p.startsWith('/out/records/posts/'))
  assert.equal(remaining.length, 1)
  assert.equal(second.written.filter(p => p.startsWith('/out/records/posts/')).length, 1)
})

test('layout switch: single → split deletes the old {name}.json', async () => {
  const mem = createMemoryFs()
  const deps = { ...singleDeps(mem, output([list('posts', [{ a: 1 }])])), layout: 'single' as const }
  const first = await writeOutput(output([list('posts', [{ a: 1 }])]), deps)
  assert.ok(mem.files.has('/out/posts.json'))
  // Switch to split layout: posts.json is no longer in the plan → deleted.
  await writeOutput(output([list('posts', [{ a: 1 }])]), { ...deps, layout: 'split' }, first.manifest)
  assert.equal(mem.files.has('/out/posts.json'), false)
  assert.ok(mem.files.has('/out/collections/posts.js'))
})

test('emptyManifest helper yields no files', () => {
  assert.deepEqual(emptyManifest(), { files: {} })
})
