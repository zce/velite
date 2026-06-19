import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import { describe, it } from 'node:test'

import { createAssetStore } from '../../src/assets'

describe('AssetStore', () => {
  it('adds a record on first call', () => {
    const store = createAssetStore()
    const record = store.add({
      sourcePath: '/abs/foo.png',
      outputName: 'foo-abc123.png'
    })
    strictEqual(record.outputName, 'foo-abc123.png')
    strictEqual(store.list().length, 1)
  })

  it('deduplicates the same outputName + sourcePath', () => {
    const store = createAssetStore()
    store.add({
      sourcePath: '/abs/foo.png',
      outputName: 'foo-abc123.png'
    })
    const second = store.add({
      sourcePath: '/abs/foo.png',
      outputName: 'foo-abc123.png'
    })
    strictEqual(second.sourcePath, '/abs/foo.png')
    strictEqual(store.list().length, 1, 'store should still hold a single record')
  })

  it('accepts duplicate outputName from a different sourcePath when fingerprints match', () => {
    const store = createAssetStore()
    store.add({
      sourcePath: '/abs/cat.webp',
      outputName: 'cat-deadbe.webp',
      fingerprint: 'deadbeef'
    })
    const merged = store.add({
      sourcePath: '/abs/dog.webp',
      outputName: 'cat-deadbe.webp',
      fingerprint: 'deadbeef'
    })
    strictEqual(merged.outputName, 'cat-deadbe.webp')
  })

  it('rejects duplicate outputName when fingerprints differ', () => {
    const store = createAssetStore()
    store.add({
      sourcePath: '/abs/foo.png',
      outputName: 'shared.png',
      fingerprint: 'aaaa'
    })
    throws(
      () =>
        store.add({
          sourcePath: '/abs/bar.png',
          outputName: 'shared.png',
          fingerprint: 'bbbb'
        }),
      /Asset name collision for 'shared\.png'/
    )
  })

  it('list reflects insertion order', () => {
    const store = createAssetStore()
    store.add({ sourcePath: '/a', outputName: 'a' })
    store.add({ sourcePath: '/b', outputName: 'b' })
    const names = store.list().map(r => r.outputName)
    deepStrictEqual(names, ['a', 'b'])
  })

  it('upgrades an existing record fingerprint when a later add provides one', () => {
    const store = createAssetStore()
    store.add({
      sourcePath: '/abs/x.png',
      outputName: 'x.png'
      // no fingerprint provided
    })
    // Same outputName, different sourcePath, with fingerprint. The store records
    // the fingerprint so the next add with a different fingerprint can be rejected.
    store.add({
      sourcePath: '/abs/y.png',
      outputName: 'x.png',
      fingerprint: 'cafe'
    })
    throws(
      () =>
        store.add({
          sourcePath: '/abs/z.png',
          outputName: 'x.png',
          fingerprint: 'beef'
        }),
      /Asset name collision/
    )
    ok(true)
  })
})
