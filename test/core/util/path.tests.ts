// test/core/util/path.tests.ts
import { equal } from 'node:assert'
import { test } from 'node:test'

import { posix } from '../../../src/core/util/path'

test('posix.join: joins and normalizes segments', () => {
  equal(posix.join('a', 'b', 'c'), 'a/b/c')
  equal(posix.join('a/', '/b'), 'a/b')
  equal(posix.join('a', '..', 'b'), 'b')
  equal(posix.join('/a', 'b'), '/a/b')
})

test('posix.normalize: collapses dots and double slashes', () => {
  equal(posix.normalize('a//b/./c'), 'a/b/c')
  equal(posix.normalize('a/b/../../c'), 'c')
  equal(posix.normalize('/a/../b'), '/b')
  equal(posix.normalize('./a'), 'a')
})

test('posix.relative: computes relative path', () => {
  equal(posix.relative('/a/b', '/a/c'), '../c')
  equal(posix.relative('/a/b/c', '/a/b'), '..')
  equal(posix.relative('/a/b', '/a/b'), '.')
})

test('posix.dirname: returns the directory portion', () => {
  equal(posix.dirname('a/b/c'), 'a/b')
  equal(posix.dirname('a'), '.')
  equal(posix.dirname('/a'), '/')
})

test('posix.extname: returns the extension', () => {
  equal(posix.extname('a.md'), '.md')
  equal(posix.extname('a/b.mdx'), '.mdx')
  equal(posix.extname('a'), '')
})
