import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert'
import { describe, it } from 'node:test'

import { createAssetStore } from '../src/core/assets'

describe('AssetStore', () => {
  it('adds a record on first call', () => {
    const store = createAssetStore()
    const record = store.add({
      sourcePath: '/abs/foo.png',
      outputName: 'foo-abc123.png',
      publicUrl: '/static/foo-abc123.png',
      ownerFile: '/site/posts/a.md'
    })
    strictEqual(record.outputName, 'foo-abc123.png')
    deepStrictEqual([...record.ownerFiles], ['/site/posts/a.md'])
    strictEqual(store.list().length, 1)
  })

  it('merges owner files for the same outputName + sourcePath', () => {
    const store = createAssetStore()
    store.add({
      sourcePath: '/abs/foo.png',
      outputName: 'foo-abc123.png',
      publicUrl: '/static/foo-abc123.png',
      ownerFile: '/site/posts/a.md'
    })
    const second = store.add({
      sourcePath: '/abs/foo.png',
      outputName: 'foo-abc123.png',
      publicUrl: '/static/foo-abc123.png',
      ownerFile: '/site/posts/b.md'
    })
    deepStrictEqual([...second.ownerFiles].sort(), ['/site/posts/a.md', '/site/posts/b.md'])
    strictEqual(store.list().length, 1, 'store should still hold a single record')
  })

  it('accepts duplicate outputName from a different sourcePath when fingerprints match', () => {
    const store = createAssetStore()
    store.add({
      sourcePath: '/abs/cat.webp',
      outputName: 'cat-deadbe.webp',
      publicUrl: '/static/cat-deadbe.webp',
      ownerFile: '/site/a.md',
      fingerprint: 'deadbeef'
    })
    const merged = store.add({
      sourcePath: '/abs/dog.webp',
      outputName: 'cat-deadbe.webp',
      publicUrl: '/static/cat-deadbe.webp',
      ownerFile: '/site/b.md',
      fingerprint: 'deadbeef'
    })
    deepStrictEqual([...merged.ownerFiles].sort(), ['/site/a.md', '/site/b.md'])
  })

  it('rejects duplicate outputName when fingerprints differ', () => {
    const store = createAssetStore()
    store.add({
      sourcePath: '/abs/foo.png',
      outputName: 'shared.png',
      publicUrl: '/static/shared.png',
      ownerFile: '/site/a.md',
      fingerprint: 'aaaa'
    })
    throws(
      () =>
        store.add({
          sourcePath: '/abs/bar.png',
          outputName: 'shared.png',
          publicUrl: '/static/shared.png',
          ownerFile: '/site/b.md',
          fingerprint: 'bbbb'
        }),
      /Asset name collision for 'shared\.png'/
    )
  })

  it('byOwner returns only records owned by the given file', () => {
    const store = createAssetStore()
    store.add({
      sourcePath: '/abs/x.png',
      outputName: 'x-1.png',
      publicUrl: '/static/x-1.png',
      ownerFile: '/site/a.md'
    })
    store.add({
      sourcePath: '/abs/y.png',
      outputName: 'y-1.png',
      publicUrl: '/static/y-1.png',
      ownerFile: '/site/b.md'
    })
    store.add({
      sourcePath: '/abs/x.png',
      outputName: 'x-1.png',
      publicUrl: '/static/x-1.png',
      ownerFile: '/site/b.md'
    })
    strictEqual(store.byOwner('/site/a.md').length, 1)
    strictEqual(store.byOwner('/site/b.md').length, 2)
    strictEqual(store.byOwner('/site/c.md').length, 0)
  })

  it('list reflects insertion order', () => {
    const store = createAssetStore()
    store.add({ sourcePath: '/a', outputName: 'a', publicUrl: '/a', ownerFile: '/o' })
    store.add({ sourcePath: '/b', outputName: 'b', publicUrl: '/b', ownerFile: '/o' })
    const names = store.list().map(r => r.outputName)
    deepStrictEqual(names, ['a', 'b'])
  })

  it('upgrades an existing record fingerprint when a later add provides one', () => {
    const store = createAssetStore()
    store.add({
      sourcePath: '/abs/x.png',
      outputName: 'x.png',
      publicUrl: '/x.png',
      ownerFile: '/o1'
      // no fingerprint provided
    })
    // Same outputName, different sourcePath, with fingerprint. The store records
    // the fingerprint so the next add with a different fingerprint can be rejected.
    store.add({
      sourcePath: '/abs/y.png',
      outputName: 'x.png',
      publicUrl: '/x.png',
      ownerFile: '/o2',
      fingerprint: 'cafe'
    })
    throws(
      () =>
        store.add({
          sourcePath: '/abs/z.png',
          outputName: 'x.png',
          publicUrl: '/x.png',
          ownerFile: '/o3',
          fingerprint: 'beef'
        }),
      /Asset name collision/
    )
    ok(true)
  })
})
