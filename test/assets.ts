import { strictEqual } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

import { getImageMetadata } from '../src/assets'

// path relative to cwd (repo root), like the other tests
const image = 'examples/basic/content/posts/2024-05-08-hello-world/cover.jpg'

describe('getImageMetadata function', async () => {
  it('generates blur placeholder with default options', async () => {
    const buffer = await readFile(image)
    const metadata = await getImageMetadata(buffer)
    strictEqual(metadata != null, true)
    strictEqual(metadata!.blurWidth, 8)
    // blurHeight is derived from the aspect ratio and is at least 1
    strictEqual(metadata!.blurHeight >= 1, true)
    strictEqual(metadata!.blurDataURL.startsWith('data:image/webp;base64,'), true)
  })

  it('respects custom blur width and derives height from aspect ratio', async () => {
    const buffer = await readFile(image)
    const metadata = await getImageMetadata(buffer, { width: 16 })
    strictEqual(metadata!.blurWidth, 16)
    const aspectRatio = metadata!.width / metadata!.height
    strictEqual(metadata!.blurHeight, Math.max(1, Math.round(16 / aspectRatio)))
  })

  it('respects explicit blur width and height', async () => {
    const buffer = await readFile(image)
    const metadata = await getImageMetadata(buffer, { width: 20, height: 20 })
    strictEqual(metadata!.blurWidth, 20)
    strictEqual(metadata!.blurHeight, 20)
  })

  it('produces a larger data url with higher blur quality', async () => {
    const buffer = await readFile(image)
    const low = await getImageMetadata(buffer, { quality: 1 })
    const high = await getImageMetadata(buffer, { quality: 80 })
    strictEqual(high!.blurDataURL.length > low!.blurDataURL.length, true)
  })
})
