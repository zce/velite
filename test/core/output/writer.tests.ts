import assert from 'node:assert/strict'
import { test } from 'node:test'

import { emptyManifest } from '../../../src/core/output/manifest'
import { writeOutput } from '../../../src/core/output/writer'
import { posix } from '../../../src/core/util/path'

import type { FileSystem } from '../../../src/core/host/fs'
import type { CollectionResult } from '../../../src/core/model'
import type { LogicalOutput } from '../../../src/core/output/logical'

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
  entries: entries.map((data, i) => ({ id: `${name}#${i}`, source: `${name}/${i}`, data }))
})

const single = (name: string, data: unknown): CollectionResult => ({
  collection: name,
  mode: 'single',
  entries: data === null ? [] : [{ id: `${name}#0`, source: `${name}/0`, data }]
})

const output = (collections: CollectionResult[]): LogicalOutput => ({
  collections: Object.fromEntries(collections.map(c => [c.collection, c]))
})

const decode = (bytes: Uint8Array | undefined): unknown => (bytes === undefined ? undefined : JSON.parse(new TextDecoder().decode(bytes)))

test('writeOutput writes ${name}.json for each list collection as an array', async () => {
  const mem = createMemoryFs()
  const out = output([list('posts', [{ title: 'a' }, { title: 'b' }])])
  const result = await writeOutput(out, { fs: mem.fs, path: posix, dir: '/out' })
  assert.deepEqual(result.written, ['/out/posts.json'])
  assert.deepEqual(decode(mem.files.get('/out/posts.json')), [{ title: 'a' }, { title: 'b' }])
  assert.equal(mem.files.has('/out/posts.json'), true)
})

test('writeOutput writes a single collection as its first entry data', async () => {
  const mem = createMemoryFs()
  const out = output([single('site', { name: 'velite' })])
  await writeOutput(out, { fs: mem.fs, path: posix, dir: '/out' })
  assert.deepEqual(decode(mem.files.get('/out/site.json')), { name: 'velite' })
})

test('writeOutput writes null for an empty single collection', async () => {
  const mem = createMemoryFs()
  const out = output([single('cfg', null)])
  await writeOutput(out, { fs: mem.fs, path: posix, dir: '/out' })
  assert.equal(decode(mem.files.get('/out/cfg.json')), null)
})

test('writeOutput returns the written list and a new manifest with digests', async () => {
  const mem = createMemoryFs()
  const out = output([list('posts', [{ a: 1 }])])
  const result = await writeOutput(out, { fs: mem.fs, path: posix, dir: '/out' })
  assert.deepEqual(result.written, ['/out/posts.json'])
  assert.deepEqual(Object.keys(result.manifest.files), ['/out/posts.json'])
  assert.equal(typeof result.manifest.files['/out/posts.json'], 'string')
  assert.equal(result.manifest.files['/out/posts.json']!.length, 16)
})

test('writeOutput skips unchanged files (same digest) on a second run', async () => {
  const mem = createMemoryFs()
  const out = output([list('posts', [{ a: 1 }])])
  const dir = { fs: mem.fs, path: posix, dir: '/out' }
  const first = await writeOutput(out, dir)
  const firstWriteCount = mem.writeCount()
  assert.equal(first.written.length, 1)
  // Second run with identical output and previous manifest: nothing rewritten.
  const second = await writeOutput(out, dir, first.manifest)
  assert.deepEqual(second.written, [])
  assert.equal(mem.writeCount(), firstWriteCount)
  assert.deepEqual(Object.keys(second.manifest.files), ['/out/posts.json'])
})

test('writeOutput rewrites a file whose content changed', async () => {
  const mem = createMemoryFs()
  const dir = { fs: mem.fs, path: posix, dir: '/out' }
  const first = await writeOutput(output([list('posts', [{ a: 1 }])]), dir)
  const second = await writeOutput(output([list('posts', [{ a: 2 }])]), dir, first.manifest)
  assert.deepEqual(second.written, ['/out/posts.json'])
  assert.deepEqual(decode(mem.files.get('/out/posts.json')), [{ a: 2 }])
})

test('writeOutput deletes stale entries present in previous manifest but not in output', async () => {
  const mem = createMemoryFs()
  const dir = { fs: mem.fs, path: posix, dir: '/out' }
  // Seed: two collections.
  const first = await writeOutput(output([list('posts', [{ a: 1 }]), list('tags', [{ t: 'x' }])]), dir)
  assert.equal(mem.files.has('/out/tags.json'), true)
  // Next run drops the "tags" collection; its file should be removed.
  const second = await writeOutput(output([list('posts', [{ a: 1 }])]), dir, first.manifest)
  assert.equal(mem.files.has('/out/tags.json'), false)
  assert.equal(mem.removeCount(), 1)
  assert.deepEqual(Object.keys(second.manifest.files), ['/out/posts.json'])
})

test('writeOutput defaults previous manifest to empty (fresh build writes everything)', async () => {
  const mem = createMemoryFs()
  const out = output([list('a', [1]), list('b', [2])])
  const result = await writeOutput(out, { fs: mem.fs, path: posix, dir: '/out' })
  assert.equal(result.written.length, 2)
  assert.equal(mem.removeCount(), 0)
})

test('writeOutput emptyManifest helper yields no files', () => {
  assert.deepEqual(emptyManifest(), { files: {} })
})
