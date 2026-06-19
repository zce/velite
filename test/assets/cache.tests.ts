import { deepStrictEqual, equal, ok } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createAssetStore, processAsset } from '../../src/assets'
import { createAssetProcessingCache } from '../../src/assets/cache'

test('processAsset memoizes source reads and records each owner reference', async () => {
  const root = await mkdtemp(join(tmpdir(), 'velite-asset-cache-'))
  try {
    const content = join(root, 'content')
    await mkdir(content)
    const a = join(content, 'a.md')
    const b = join(content, 'b.md')
    const asset = join(content, 'shared.txt')
    await writeFile(a, '')
    await writeFile(b, '')
    await writeFile(asset, 'asset')

    const cache = createAssetProcessingCache()
    const firstStore = createAssetStore()
    const secondStore = createAssetStore()

    const first = await processAsset('shared.txt', a, '[name]-[hash:6].[ext]', '/static/', firstStore, undefined, undefined, cache)
    const second = await processAsset('shared.txt', b, '[name]-[hash:6].[ext]', '/static/', secondStore, undefined, undefined, cache)

    equal(first, second)
    equal(firstStore.list().length, 1)
    equal(secondStore.list().length, 1)
    deepStrictEqual(cache.invalidateSource(asset).sort(), [a, b].sort())
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('cache.invalidateSource removes cached entries and forgets owners', async () => {
  const root = await mkdtemp(join(tmpdir(), 'velite-asset-cache-'))
  try {
    const content = join(root, 'content')
    await mkdir(content)
    const owner = join(content, 'owner.md')
    const asset = join(content, 'asset.txt')
    await writeFile(owner, '')
    await writeFile(asset, 'asset')

    const cache = createAssetProcessingCache()
    const store = createAssetStore()

    await processAsset('asset.txt', owner, '[name]-[hash:6].[ext]', '/static/', store, undefined, undefined, cache)
    ok(cache.hasSource(asset))

    const owners = cache.invalidateSource(asset)
    deepStrictEqual(owners, [owner])
    equal(cache.hasSource(asset), false)

    // A second invalidation has nothing to report — entries and owners were forgotten.
    deepStrictEqual(cache.invalidateSource(asset), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('processAsset legacy path (no cache) keeps original behavior', async () => {
  const root = await mkdtemp(join(tmpdir(), 'velite-asset-cache-'))
  try {
    const content = join(root, 'content')
    await mkdir(content)
    const owner = join(content, 'page.md')
    const asset = join(content, 'doc.txt')
    await writeFile(owner, '')
    await writeFile(asset, 'doc')

    const store = createAssetStore()
    const url = await processAsset('doc.txt', owner, '[name]-[hash:6].[ext]', '/static/', store)

    ok(typeof url === 'string')
    ok(url.startsWith('/static/doc-'))
    equal(store.list().length, 1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
