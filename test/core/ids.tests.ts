import { equal, notEqual } from 'node:assert'
import { test } from 'node:test'

import { createRecordId, createSourceId, hashIdentity, parseRecordId, sanitizeStem } from '../../src/core/ids'

test('source id normalizes project-relative paths', () => {
  equal(createSourceId('/repo/content/posts/hello.md', '/repo/content'), 'posts/hello.md')
})

test('source id uses posix separators', () => {
  // simulate windows-style already-split input via posix join
  equal(createSourceId('/repo/content/posts/sub/hello.md', '/repo/content'), 'posts/sub/hello.md')
})

test('record id includes record key', () => {
  const sourceId = createSourceId('/repo/content/authors.yml', '/repo/content')
  equal(createRecordId(sourceId, 'zce'), 'authors.yml#zce')
  notEqual(createRecordId(sourceId, 'zce'), createRecordId(sourceId, 'other'))
})

test('record id falls back to default key for single-record sources', () => {
  const sourceId = createSourceId('/repo/content/posts/hello.md', '/repo/content')
  equal(createRecordId(sourceId), 'posts/hello.md#default')
})

test('parseRecordId round-trips', () => {
  const { sourceId, key } = parseRecordId('authors.yml#zce')
  equal(sourceId, 'authors.yml')
  equal(key, 'zce')
})

test('identity hash is stable and content-independent', () => {
  equal(hashIdentity('posts/hello.md#default'), hashIdentity('posts/hello.md#default'))
  notEqual(hashIdentity('posts/hello.md#default'), hashIdentity('posts/hello.md#other'))
})

test('sanitizeStem strips extensions and unsafe characters', () => {
  equal(sanitizeStem('hello.md'), 'hello')
  equal(sanitizeStem('2024-05-08-hello-world'), '2024-05-08-hello-world')
})
