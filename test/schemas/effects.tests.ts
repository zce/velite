import { equal } from 'node:assert'
import { test } from 'node:test'

import { createEffectIndex } from '../../src/schemas/effects'

test('unique effects release old owner values on patch', () => {
  const index = createEffectIndex()
  index.apply([{ type: 'unique', owner: 'record:a', group: 'slug', value: 'hello' }])

  const candidate = index.patch(['record:a'], [{ type: 'unique', owner: 'record:a', group: 'slug', value: 'hello-v2' }])

  equal(candidate.findUniqueConflict('slug', 'hello', 'record:b'), undefined)
  equal(candidate.findUniqueConflict('slug', 'hello-v2', 'record:b'), 'record:a')
})

test('patch does not mutate the committed index', () => {
  const index = createEffectIndex()
  index.apply([{ type: 'unique', owner: 'record:a', group: 'slug', value: 'hello' }])

  index.patch(['record:a'], [{ type: 'unique', owner: 'record:a', group: 'slug', value: 'hello-v2' }])

  // committed index still has the original value
  equal(index.findUniqueConflict('slug', 'hello', 'record:b'), 'record:a')
})

test('findUniqueConflict ignores the querying owner itself', () => {
  const index = createEffectIndex()
  index.apply([{ type: 'unique', owner: 'record:a', group: 'slug', value: 'hello' }])
  equal(index.findUniqueConflict('slug', 'hello', 'record:a'), undefined)
  equal(index.findUniqueConflict('slug', 'hello', 'record:b'), 'record:a')
})

test('asset references are tracked per owner', () => {
  const index = createEffectIndex()
  index.apply([{ type: 'asset', owner: 'record:a', assetPath: '/abs/img.png', publicUrl: '/static/img.png', isImage: true }])
  equal(index.assetReferencesOf('record:a').length, 1)
  equal(index.assetReferencesOf('record:b').length, 0)
})
