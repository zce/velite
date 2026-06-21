// Unit tests for the asset derivation: placeholder fallback, real probe,
// memoization, and backdating (re-set same bytes → no dependent recompute).
// Uses a stub ImageProcessor (no sharp) + a fake engine input, so these run
// without native deps.
import { equal, match, ok } from 'node:assert/strict'
import { mock, test } from 'node:test'

import { createEngine } from '../../src/core/engine'
import { assetInput, createAssetDerivation, publicUrlOf } from '../../src/core/pipeline/asset'
import { posix } from '../../src/core/util/path'

import type { ResolvedConfig } from '../../src/core/config'
import type { Derivation } from '../../src/core/engine'
import type { Host } from '../../src/core/host'
import type { AssetResult } from '../../src/core/pipeline/asset'

const config: ResolvedConfig = {
  root: '/proj/content',
  configPath: '',
  output: { data: '/proj/.velite', assets: '/proj/public/static', base: '/static/', name: 'static' },
  collections: []
}

const bytes = (n: number): Uint8Array => {
  const b = new Uint8Array(n)
  for (let i = 0; i < n; i++) b[i] = i % 256
  return b
}

const makeHost = (image: Host['image']): Host => ({
  fs: { read: async () => new Uint8Array(), stat: async () => ({ mtimeMs: 0, size: 0 }), walk: async () => [], write: async () => {}, remove: async () => {} },
  config: { load: async () => ({ config: {}, dependencies: [] }) },
  path: posix,
  image
})

test('asset derivation: returns a placeholder (no throw) when the asset input is unset', async () => {
  const engine = createEngine()
  const asset = createAssetDerivation(config, makeHost(undefined))
  const result = await engine.get(asset, 'posts/cover.png')
  // publicUrl is derivable from the key alone (no hash): /static/cover.png
  equal(result.publicUrl, '/static/cover.png')
  equal(result.width, 0)
  equal(result.height, 0)
  equal(result.format, '')
  equal(result.blurDataURL, '')
  equal(result.blurWidth, 0)
  equal(result.blurHeight, 0)
})

test('asset derivation: probes and returns real metadata + content-hashed url when bytes are set', async () => {
  const engine = createEngine()
  const probe = mock.fn(async (_data: Uint8Array) => ({ width: 100, height: 50, format: 'png' }))
  const blur = mock.fn(async (_data: Uint8Array) => 'data:image/webp;base64,AAA')
  const asset = createAssetDerivation(config, makeHost({ probe, blurDataURL: blur }))

  const data = bytes(64)
  engine.set(assetInput('posts/cover.png'), data)
  const result = await engine.get(asset, 'posts/cover.png')

  // content-hashed url: /static/cover-<8 hex>.png
  match(result.publicUrl, /^\/static\/cover-[0-9a-f]{8}\.png$/)
  equal(result.width, 100)
  equal(result.height, 50)
  equal(result.format, 'png')
  equal(result.blurDataURL, 'data:image/webp;base64,AAA')
  equal(result.blurWidth, 8)
  equal(result.blurHeight, 4) // round(8 * 50 / 100)
  equal(probe.mock.calls.length, 1)
})

test('asset derivation: no-sharp degradation — real url, zero metadata when host has no image processor', async () => {
  const engine = createEngine()
  const asset = createAssetDerivation(config, makeHost(undefined))
  engine.set(assetInput('docs/a.pdf'), bytes(16))
  const result = await engine.get(asset, 'docs/a.pdf')
  // real content-hashed url, but zero metadata
  match(result.publicUrl, /^\/static\/a-[0-9a-f]{8}\.pdf$/)
  equal(result.width, 0)
  equal(result.height, 0)
  equal(result.format, '')
  equal(result.blurDataURL, '')
})

test('asset derivation: memoizes — probe runs once across repeated demands', async () => {
  const engine = createEngine()
  const probe = mock.fn(async () => ({ width: 10, height: 10, format: 'png' }))
  const blur = mock.fn(async () => 'data:image/webp;base64,AAA')
  const asset = createAssetDerivation(config, makeHost({ probe, blurDataURL: blur }))
  engine.set(assetInput('x.png'), bytes(8))

  await engine.get(asset, 'x.png')
  await engine.get(asset, 'x.png')
  await engine.get(asset, 'x.png')
  equal(probe.mock.calls.length, 1)
  equal(blur.mock.calls.length, 1)
})

test('asset derivation: backdating — re-setting equal bytes does not recompute dependents', async () => {
  const engine = createEngine()
  const probe = mock.fn(async () => ({ width: 10, height: 10, format: 'png' }))
  const blur = mock.fn(async () => 'data:image/webp;base64,AAA')
  const asset = createAssetDerivation(config, makeHost({ probe, blurDataURL: blur }))

  // A dependent that reads the asset derivation.
  const consumerFn = mock.fn(async (ctx: never): Promise<AssetResult> => {
    // ctx is the engine Context; demand the asset through it
    const c = ctx as unknown as { get: (d: Derivation<string, AssetResult>, k: string) => Promise<AssetResult> }
    return c.get(asset, 'y.png')
  })
  const consumer: Derivation<null, AssetResult> = { name: 'consumer', compute: consumerFn }

  const data = bytes(32)
  engine.set(assetInput('y.png'), data)
  const first = await engine.get(consumer, null)
  equal(first.width, 10)
  const probeAfterFirst = probe.mock.calls.length
  const consumerAfterFirst = consumerFn.mock.calls.length
  ok(probeAfterFirst >= 1)

  // Re-set the SAME bytes — engine.set no-ops (equal hash), nothing recomputes.
  engine.set(assetInput('y.png'), data)
  const second = await engine.get(consumer, null)
  equal(second.width, 10)
  equal(probe.mock.calls.length, probeAfterFirst) // probe not called again
  equal(consumerFn.mock.calls.length, consumerAfterFirst) // dependent not recomputed
})

test('asset derivation: changing the bytes recomputes the asset and its dependents', async () => {
  const engine = createEngine()
  let dims = { width: 10, height: 10, format: 'png' }
  const probe = mock.fn(async () => dims)
  const blur = mock.fn(async () => 'data:image/webp;base64,AAA')
  const asset = createAssetDerivation(config, makeHost({ probe, blurDataURL: blur }))

  const consumerFn = mock.fn(async (ctx: never): Promise<AssetResult> => {
    const c = ctx as unknown as { get: (d: Derivation<string, AssetResult>, k: string) => Promise<AssetResult> }
    return c.get(asset, 'z.png')
  })
  const consumer: Derivation<null, AssetResult> = { name: 'consumer2', compute: consumerFn }

  engine.set(assetInput('z.png'), bytes(8))
  equal((await engine.get(consumer, null)).width, 10)

  dims = { width: 99, height: 99, format: 'png' }
  engine.set(assetInput('z.png'), bytes(16)) // different bytes → recompute
  equal((await engine.get(consumer, null)).width, 99)
  ok(consumerFn.mock.calls.length >= 2) // dependent recomputed
})

test('asset derivation: placeholder dependency is tracked — setting the input later upgrades the result', async () => {
  const engine = createEngine()
  const probe = mock.fn(async () => ({ width: 42, height: 42, format: 'png' }))
  const blur = mock.fn(async () => 'data:image/webp;base64,AAA')
  const asset = createAssetDerivation(config, makeHost({ probe, blurDataURL: blur }))

  // First demand with no input → placeholder (dependency on the input recorded).
  const before = await engine.get(asset, 'w.png')
  equal(before.width, 0)
  equal(before.publicUrl, '/static/w.png')

  // Now feed the bytes — the recorded dependency invalidates the memo.
  engine.set(assetInput('w.png'), bytes(8))
  const after = await engine.get(asset, 'w.png')
  equal(after.width, 42)
  match(after.publicUrl, /^\/static\/w-[0-9a-f]{8}\.png$/)
})

test('publicUrlOf: placeholder url has no hash; real url is content-hashed', () => {
  equal(publicUrlOf('a/b.png', undefined, config), '/static/b.png')
  const url = publicUrlOf('a/b.png', bytes(4), config)
  match(url, /^\/static\/b-[0-9a-f]{8}\.png$/)
})

test('asset derivation: dimensionless image (width 0) skips blur — no divide-by-zero, consistent zeros', async () => {
  const engine = createEngine()
  const probe = mock.fn(async () => ({ width: 0, height: 0, format: 'svg' }))
  const blur = mock.fn(async () => 'data:image/webp;base64,SHOULD-NOT-BE-CALLED')
  const asset = createAssetDerivation(config, makeHost({ probe, blurDataURL: blur }))
  engine.set(assetInput('logo.svg'), bytes(16))

  const result = await engine.get(asset, 'logo.svg')
  equal(result.width, 0)
  equal(result.height, 0)
  // blurDataURL must be empty (not the would-be data url), so consumers can key
  // on "blurDataURL non-empty ⇒ dimensions valid". blur generation is skipped.
  equal(result.blurDataURL, '')
  equal(result.blurWidth, 0)
  equal(result.blurHeight, 0)
  equal(blur.mock.calls.length, 0) // blurDataURL never invoked for a dimensionless image
})
