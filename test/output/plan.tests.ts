import { deepStrictEqual, equal } from 'node:assert'
import { test } from 'node:test'

import { planSplitOutput } from '../../src/output/plan'

test('split output uses stable record identity paths, not content hashes', () => {
  const first = planSplitOutput('posts', [{ id: 'posts/hello.md#default', data: { title: 'A' } }], undefined)
  const second = planSplitOutput('posts', [{ id: 'posts/hello.md#default', data: { title: 'B' } }], first.state)

  equal(first.writes[0].path, second.writes[0].path)
  deepStrictEqual(
    second.writes.map(write => write.kind),
    ['record']
  )
})

test('split output paths differ per record identity', () => {
  const result = planSplitOutput('posts', [
    { id: 'posts/hello.md#default', data: {} },
    { id: 'posts/world.md#default', data: {} }
  ])
  equal(result.writes.length, 2)
  notEqualSafe(result.writes[0].path, result.writes[1].path)
})

test('split state records all written paths per collection', () => {
  const result = planSplitOutput('posts', [{ id: 'posts/hello.md#default', data: {} }])
  equal(result.state.paths.get('posts')?.length, 1)
})

const notEqualSafe = (a: string, b: string): void => {
  equal(a === b, false)
}
