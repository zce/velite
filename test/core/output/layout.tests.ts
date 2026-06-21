import assert from 'node:assert/strict'
import { test } from 'node:test'

import { collectionDataPath, collectionEntryPath, entryPath, recordFilePath, typesPath } from '../../../src/core/output/layout'

test('recordFilePath: stable across content-only changes (identity hash, not content)', () => {
  // The path depends only on the record id (identity), not on the data.
  const a = recordFilePath('posts', 'posts/hello.md#default')
  const b = recordFilePath('posts', 'posts/hello.md#default')
  assert.equal(a, b)
  assert.ok(a.startsWith('records/posts/'))
  assert.ok(a.endsWith('.json'))
})

test('recordFilePath: differs per record identity', () => {
  const a = recordFilePath('posts', 'posts/hello.md#default')
  const b = recordFilePath('posts', 'posts/world.md#default')
  assert.notEqual(a, b)
})

test('recordFilePath: uses the record key stem for multi-record sources', () => {
  const path = recordFilePath('authors', 'authors.yml#zce')
  assert.ok(path.startsWith('records/authors/zce.'), path)
})

test('recordFilePath: uses the source basename stem for single-record sources', () => {
  const path = recordFilePath('posts', 'posts/hello-world.md#default')
  assert.ok(path.startsWith('records/posts/hello-world.'), path)
})

test('recordFilePath: collections are isolated by key', () => {
  const a = recordFilePath('posts', 'shared.md#default')
  const b = recordFilePath('notes', 'shared.md#default')
  assert.notEqual(a, b)
  assert.ok(a.startsWith('records/posts/'))
  assert.ok(b.startsWith('records/notes/'))
})

test('collectionEntryPath: split layout collection entry', () => {
  assert.equal(collectionEntryPath('posts'), 'collections/posts.js')
})

test('collectionDataPath: single layout collection data', () => {
  assert.equal(collectionDataPath('posts'), 'posts.json')
})

test('entryPath and typesPath are the shared entry + declaration files', () => {
  assert.equal(entryPath(), 'index.js')
  assert.equal(typesPath(), 'index.d.ts')
})
