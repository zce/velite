// Tests for the pure posix path utilities used throughout the core. These
// utilities replace `node:path/posix` so the core stays runtime-neutral; they
// need their own behavioural tests rather than borrowing Node's.
import { equal } from 'node:assert/strict'
import { test } from 'node:test'

import { dirname, extname, join, normalize, relative } from '../../../src/core/util/path'

test('join: joins and normalizes segments', () => {
  equal(join('a', 'b', 'c'), 'a/b/c')
  equal(join('a/', '/b'), 'a/b')
  equal(join('a', '..', 'b'), 'b')
  equal(join('/a', 'b'), '/a/b')
  equal(join('/'), '/')
})

test('join: empty input collapses to "."', () => {
  equal(join(), '.')
  equal(join(''), '.')
})

test('normalize: collapses dots and double slashes', () => {
  equal(normalize('a//b/./c'), 'a/b/c')
  equal(normalize('a/b/../../c'), 'c')
  equal(normalize('/a/../b'), '/b')
  equal(normalize('./a'), 'a')
  equal(normalize(''), '.')
  equal(normalize('.'), '.')
  equal(normalize('/'), '/')
})

test('normalize: ".." escapes from a relative path; clamped at the root of an absolute path', () => {
  equal(normalize('../a'), '../a')
  equal(normalize('../../a'), '../../a')
  equal(normalize('/../a'), '/a')
  equal(normalize('/a/../..'), '/')
})

test('relative: computes relative path', () => {
  equal(relative('/a/b', '/a/c'), '../c')
  equal(relative('/a/b/c', '/a/b'), '..')
  equal(relative('/a/b', '/a/b'), '.')
  equal(relative('/a', '/a/b/c'), 'b/c')
  equal(relative('/a/b', '/c/d'), '../../c/d')
})

test('relative: relative-to-relative is supported', () => {
  equal(relative('a/b', 'a/b/c'), 'c')
  equal(relative('a/b', 'c/d'), '../../c/d')
})

test('dirname: returns the directory portion', () => {
  equal(dirname('a/b/c'), 'a/b')
  equal(dirname('a'), '.')
  equal(dirname('/a'), '/')
  equal(dirname('/a/b'), '/a')
})

test('dirname: bare root and dot edge cases', () => {
  equal(dirname('/'), '/')
  // No slash → current directory.
  equal(dirname(''), '.')
})

test('extname: returns the extension or empty', () => {
  equal(extname('a.md'), '.md')
  equal(extname('a/b.mdx'), '.mdx')
  equal(extname('a'), '')
  equal(extname('a/b'), '')
  // Leading-dot files have no extension (matches node:path behaviour).
  equal(extname('.hidden'), '')
  equal(extname('a/.hidden'), '')
  // Trailing dot returns the dot itself.
  equal(extname('a.'), '.')
  // Multiple dots → only the last extension is returned.
  equal(extname('archive.tar.gz'), '.gz')
})
