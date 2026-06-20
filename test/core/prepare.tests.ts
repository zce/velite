import { deepStrictEqual } from 'node:assert'
import { test } from 'node:test'

import { applyPrepare } from '../../src/core/pipeline'

test('prepare may mutate existing logical output and return void', async () => {
  const result = { posts: [{ title: 'A' }], tags: [] as Array<{ name: string }> }
  const prepared = await applyPrepare(result, ({ tags }) => {
    tags.push({ name: 'docs' })
  })

  deepStrictEqual(prepared, { action: 'continue', result: { posts: [{ title: 'A' }], tags: [{ name: 'docs' }] } })
})

test('prepare may return a replacement logical output', async () => {
  const result = { posts: [{ title: 'A' }] }
  const prepared = await applyPrepare(result, () => ({ posts: [{ title: 'B' }] }))

  deepStrictEqual(prepared, { action: 'continue', result: { posts: [{ title: 'B' }] } })
})

test('prepare false skips default output', async () => {
  const result = { posts: [] }
  const prepared = await applyPrepare(result, () => false)

  deepStrictEqual(prepared, { action: 'skip-output', result: { posts: [] } })
})

test('prepare undefined hook continues with the original result', async () => {
  const result = { posts: [{ title: 'A' }] }
  const prepared = await applyPrepare(result, undefined)
  deepStrictEqual(prepared, { action: 'continue', result: { posts: [{ title: 'A' }] } })
})
