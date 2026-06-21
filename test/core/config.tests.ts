import assert from 'node:assert/strict'
import { test } from 'node:test'

import { defineConfig, resolveConfig, validateConfig } from '../../src/core/config'
import { s } from '../../src/core/schema/s'
import { posix } from '../../src/core/util/path'

test('resolveConfig applies defaults: root=".", data=".velite"', () => {
  const cfg = defineConfig({ collections: { posts: { pattern: 'posts/*.md', schema: s.object({ title: s.string() }) } } })
  const resolved = resolveConfig(cfg, { cwd: '/proj', path: posix })
  assert.equal(resolved.root, '/proj')
  assert.equal(resolved.output.data, '/proj/.velite')
})

test('resolveConfig resolves root and output to absolute paths', () => {
  const cfg = defineConfig({ root: 'content', output: { data: 'dist/data' }, collections: { posts: { pattern: '*.md', schema: s.string() } } })
  const resolved = resolveConfig(cfg, { cwd: '/proj', path: posix })
  assert.equal(resolved.root, '/proj/content')
  assert.equal(resolved.output.data, '/proj/dist/data')
})

test('resolveConfig normalizes collection pattern/exclude/single/schema', () => {
  const cfg = defineConfig({
    collections: {
      posts: { pattern: ['posts/*.md', 'posts/**/*.md'], exclude: 'drafts/**', single: true, schema: s.string() }
    }
  })
  const resolved = resolveConfig(cfg, { cwd: '/proj', path: posix })
  assert.equal(resolved.collections.length, 1)
  const c = resolved.collections[0]!
  assert.equal(c.name, 'posts')
  assert.deepEqual(c.include, ['posts/*.md', 'posts/**/*.md'])
  assert.deepEqual(c.exclude, ['drafts/**'])
  assert.equal(c.single, true)
  assert.strictEqual(c.schema, cfg.collections.posts!.schema)
})

test('resolveConfig defaults typeName to the collection key and format to esm', () => {
  const cfg = defineConfig({ collections: { posts: { pattern: '*.md', schema: s.string() } } })
  const resolved = resolveConfig(cfg, { cwd: '/proj', path: posix })
  assert.equal(resolved.collections[0]!.typeName, 'posts')
  assert.equal(resolved.output.format, 'esm')
})

test('resolveConfig honors an explicit typeName and format', () => {
  const cfg = defineConfig({
    output: { format: 'cjs' },
    collections: { posts: { pattern: '*.md', typeName: 'Post', schema: s.string() } }
  })
  const resolved = resolveConfig(cfg, { cwd: '/proj', path: posix })
  assert.equal(resolved.collections[0]!.typeName, 'Post')
  assert.equal(resolved.output.format, 'cjs')
})

test('resolveConfig defaults single to false and exclude to empty', () => {
  const cfg = defineConfig({ collections: { a: { pattern: 'a/*.json', schema: s.unknown() } } })
  const resolved = resolveConfig(cfg, { cwd: '/', path: posix })
  assert.equal(resolved.collections[0]!.single, false)
  assert.deepEqual(resolved.collections[0]!.exclude, [])
})

test('validateConfig: non-object config yields a CONFIG_INVALID diagnostic', () => {
  const diags = validateConfig('nope')
  assert.equal(diags.length, 1)
  assert.equal(diags[0]!.code, 'CONFIG_INVALID')
  assert.equal(diags[0]!.level, 'error')
})

test('validateConfig: missing collections object yields a CONFIG_INVALID diagnostic', () => {
  const diags = validateConfig({ root: '.' })
  assert.equal(diags.length, 1)
  assert.equal(diags[0]!.code, 'CONFIG_INVALID')
  assert.ok(diags[0]!.message.includes('collections'))
})

test('validateConfig: collection missing pattern yields a diagnostic', () => {
  const diags = validateConfig({ collections: { posts: { schema: s.string() } } })
  const codes = diags.map(d => d.code)
  assert.ok(codes.includes('CONFIG_INVALID'))
  assert.ok(diags.some(d => d.collection === 'posts' && d.message.includes('pattern')))
})

test('validateConfig: collection missing schema yields a diagnostic', () => {
  const diags = validateConfig({ collections: { posts: { pattern: '*.md' } } })
  assert.ok(diags.some(d => d.collection === 'posts' && d.message.includes('schema')))
})

test('validateConfig: valid config yields no diagnostics', () => {
  const diags = validateConfig({ collections: { posts: { pattern: '*.md', schema: s.string() } } })
  assert.deepEqual(diags, [])
})
