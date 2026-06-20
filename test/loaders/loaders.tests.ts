import { deepStrictEqual, equal, ok, rejects } from 'node:assert'
import { test } from 'node:test'

import { builtinLoaders, defineLoader, matchesLoader } from '../../src/loaders'
import { jsonLoader } from '../../src/loaders/json'
import { matterLoader } from '../../src/loaders/matter'
import { yamlLoader } from '../../src/loaders/yaml'

const source = (path: string, content: string) => ({ id: path, path, content })

test('json loader parses a single object into one record', async () => {
  const result = await jsonLoader.load(source('a.json', '{"title":"A"}'), { source: source('a.json', '') })
  equal(result.records.length, 1)
  deepStrictEqual(result.records[0].data, { title: 'A' })
})

test('json loader parses an array into multiple keyed records', async () => {
  const result = await jsonLoader.load(source('a.json', '[{"x":1},{"x":2}]'), { source: source('a.json', '') })
  equal(result.records.length, 2)
  equal(result.records[0].key, '0')
  equal(result.records[1].key, '1')
})

test('yaml loader parses yaml documents', async () => {
  const result = await yamlLoader.load(source('a.yml', 'name: A\nvalue: 1'), { source: source('a.yml', '') })
  deepStrictEqual(result.records[0].data, { name: 'A', value: 1 })
})

test('matter loader splits frontmatter and body content', async () => {
  const result = await matterLoader.load(source('a.md', '---\ntitle: Hello\n---\n\n# Body'), { source: source('a.md', '') })
  equal(result.records.length, 1)
  deepStrictEqual(result.records[0].data, { title: 'Hello' })
  equal(result.records[0].metadata?.content, '# Body')
})

test('matter loader handles files without frontmatter', async () => {
  const result = await matterLoader.load(source('a.md', 'just body'), { source: source('a.md', '') })
  deepStrictEqual(result.records[0].data, {})
  equal(result.records[0].metadata?.content, 'just body')
})

test('matchesLoader supports regex and function tests', () => {
  equal(matchesLoader(jsonLoader, source('a.json', '')), true)
  equal(matchesLoader(yamlLoader, source('a.yml', '')), true)
  equal(matchesLoader(matterLoader, source('a.md', '')), true)
  const custom = defineLoader({ test: s => s.path.endsWith('.csv'), load: async () => ({ records: [] }) })
  equal(matchesLoader(custom, source('a.csv', '')), true)
})

test('builtin loaders cover json, yaml and matter', () => {
  equal(builtinLoaders.length, 3)
  ok(builtinLoaders.some(l => matchesLoader(l, source('a.json', ''))))
  ok(builtinLoaders.some(l => matchesLoader(l, source('a.yml', ''))))
  ok(builtinLoaders.some(l => matchesLoader(l, source('a.md', ''))))
})
