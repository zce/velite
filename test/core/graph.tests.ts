import { deepStrictEqual, equal } from 'node:assert'
import { test } from 'node:test'

import { createDependencyGraph } from '../../src/core/graph'

test('graph invalidates records and outputs from source changes', () => {
  const graph = createDependencyGraph()
  graph.addEdge('source:posts/a.md', 'record:posts/a.md#default', 'source-produces-record')
  graph.addEdge('record:posts/a.md#default', 'asset:posts/a.png', 'record-references-asset')
  graph.addEdge('record:posts/a.md#default', 'output:records/posts/a.json', 'record-produces-output')

  deepStrictEqual(Array.from(graph.invalidate(['source:posts/a.md'])).sort(), [
    'asset:posts/a.png',
    'output:records/posts/a.json',
    'record:posts/a.md#default',
    'source:posts/a.md'
  ])
})

test('graph invalidation is scoped to reachable subgraph', () => {
  const graph = createDependencyGraph()
  graph.addEdge('source:a.md', 'record:a', 'source-produces-record')
  graph.addEdge('source:b.md', 'record:b', 'source-produces-record')

  deepStrictEqual(Array.from(graph.invalidate(['source:a.md'])).sort(), ['record:a', 'source:a.md'])
})

test('removeNode drops touching edges', () => {
  const graph = createDependencyGraph()
  graph.addEdge('source:a.md', 'record:a', 'reason')
  graph.removeNode('record:a')
  deepStrictEqual(graph.successors('source:a.md'), [])
  equal(graph.nodes().includes('record:a'), false)
})
