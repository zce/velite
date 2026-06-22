import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createLoaderRegistry } from '../../src/core/loader'
import { jsonLoader } from '../../src/core/loader/json'
import { matterLoader } from '../../src/core/loader/matter'
import { yamlLoader } from '../../src/core/loader/yaml'

import type { LoaderInput } from '../../src/core/loader'

const input = (path: string, text: string): LoaderInput => ({
  path,
  bytes: new TextEncoder().encode(text),
  text
})

test('jsonLoader: top-level array yields one item per element keyed by index', () => {
  const result = jsonLoader.load(input('data.json', '[{"a":1},{"a":2}]'))
  assert.equal(result.items.length, 2)
  assert.equal(result.items[0]!.key, 0)
  assert.deepEqual(result.items[0]!.data, { a: 1 })
  assert.equal(result.items[1]!.key, 1)
  assert.deepEqual(result.items[1]!.data, { a: 2 })
})

test('jsonLoader: top-level object yields a single item with empty key', () => {
  const result = jsonLoader.load(input('data.json', '{"a":1}'))
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0]!.key, '')
  assert.deepEqual(result.items[0]!.data, { a: 1 })
})

test('jsonLoader: invalid JSON yields a LOADER_FAILED diagnostic', () => {
  const result = jsonLoader.load(input('bad.json', '{not json'))
  assert.equal(result.items.length, 0)
  assert.equal(result.diagnostics?.length, 1)
  assert.equal(result.diagnostics![0]!.code, 'LOADER_FAILED')
  assert.equal(result.diagnostics![0]!.file, 'bad.json')
  assert.equal(result.diagnostics![0]!.level, 'error')
})

test('yamlLoader: top-level sequence yields one item per element keyed by index', () => {
  const result = yamlLoader.load(input('data.yaml', '- a: 1\n- a: 2\n'))
  assert.equal(result.items.length, 2)
  assert.equal(result.items[0]!.key, 0)
  assert.deepEqual(result.items[0]!.data, { a: 1 })
  assert.deepEqual(result.items[1]!.data, { a: 2 })
})

test('yamlLoader: mapping yields a single item with empty key', () => {
  const result = yamlLoader.load(input('data.yml', 'a: 1\n'))
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0]!.key, '')
  assert.deepEqual(result.items[0]!.data, { a: 1 })
})

test('yamlLoader: invalid YAML yields a LOADER_FAILED diagnostic', () => {
  const result = yamlLoader.load(input('bad.yaml', '\t\ta: [unclosed'))
  assert.equal(result.items.length, 0)
  assert.equal(result.diagnostics![0]!.code, 'LOADER_FAILED')
  assert.equal(result.diagnostics![0]!.file, 'bad.yaml')
})

test('matterLoader: with frontmatter merges meta fields with content', () => {
  const result = matterLoader.load(input('post.md', '---\ntitle: Hello\ntags: [a, b]\n---\n# Body\n'))
  assert.equal(result.items.length, 1)
  const data = result.items[0]!.data as { title: string; tags: string[]; content: string }
  assert.equal(data.title, 'Hello')
  assert.deepEqual(data.tags, ['a', 'b'])
  assert.equal(data.content, '# Body\n')
})

test('matterLoader: without frontmatter wraps text as { content }', () => {
  const result = matterLoader.load(input('post.md', '# No frontmatter\n'))
  assert.equal(result.items.length, 1)
  assert.deepEqual(result.items[0]!.data, { content: '# No frontmatter\n' })
})

test('matterLoader: invalid frontmatter yields a LOADER_FAILED diagnostic', () => {
  const result = matterLoader.load(input('bad.md', '---\n: : : bad\n---\nbody\n'))
  assert.equal(result.items.length, 0)
  assert.equal(result.diagnostics![0]!.code, 'LOADER_FAILED')
  assert.equal(result.diagnostics![0]!.file, 'bad.md')
})

test('createLoaderRegistry: resolves builtin loaders by extension', () => {
  const registry = createLoaderRegistry()
  assert.equal(registry.resolve('a/b.json')?.name, 'json')
  assert.equal(registry.resolve('a/b.yaml')?.name, 'yaml')
  assert.equal(registry.resolve('a/b.yml')?.name, 'yaml')
  assert.equal(registry.resolve('a/b.md')?.name, 'matter')
  assert.equal(registry.resolve('a/b.mdx')?.name, 'matter')
})

test('createLoaderRegistry: returns undefined for unknown extension', () => {
  const registry = createLoaderRegistry()
  assert.equal(registry.resolve('a/b.txt'), undefined)
})

test('createLoaderRegistry: custom loaders take precedence over builtins', () => {
  const customJson: typeof jsonLoader = {
    name: 'custom-json',
    match: ['.json'],
    load: ({ text }) => ({ items: [{ key: 'custom', data: text }] })
  }
  const registry = createLoaderRegistry([customJson])
  const resolved = registry.resolve('a/b.json')
  assert.equal(resolved?.name, 'custom-json')
  const result = resolved!.load(input('b.json', '{"x":1}'))
  assert.equal(result.items[0]!.key, 'custom')
})

test('createLoaderRegistry: custom loader with predicate match', () => {
  const custom = {
    name: 'odd',
    match: (path: string) => path.endsWith('.odd'),
    load: ({ text }: LoaderInput) => ({ items: [{ key: '', data: text }] })
  }
  const registry = createLoaderRegistry([custom])
  assert.equal(registry.resolve('a/b.odd')?.name, 'odd')
  assert.equal(registry.resolve('a/b.json')?.name, 'json')
})
