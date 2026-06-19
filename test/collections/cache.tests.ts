import { ok, strictEqual } from 'node:assert'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { createFileCache } from '../../src/collections/cache'
import { VeliteFile } from '../../src/collections/file'

import type { VeliteLoader } from '../../src/loaders/types'

const jsonLoader: VeliteLoader = {
  test: /\.json$/,
  load: file => ({ data: JSON.parse(file.toString()) })
}

describe('FileCache', () => {
  it('reads a file once and caches subsequent gets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-file-cache-'))
    try {
      await mkdir(root, { recursive: true })
      const path = join(root, 'item.json')
      await writeFile(path, JSON.stringify({ title: 'hello' }))

      let calls = 0
      const cache = createFileCache(async (p, loaders) => {
        calls++
        return VeliteFile.create(p, loaders)
      })

      const first = await cache.load(path, [jsonLoader])
      const second = await cache.load(path, [jsonLoader])

      strictEqual(calls, 1, 'underlying loader should be invoked exactly once')
      strictEqual(first, second, 'cache should return the same instance')
      ok(cache.get(path) === first)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('delete drops a single entry; clear empties the cache', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-file-cache-'))
    try {
      const a = join(root, 'a.json')
      const b = join(root, 'b.json')
      await writeFile(a, '{"data":1}')
      await writeFile(b, '{"data":2}')

      let calls = 0
      const cache = createFileCache(async (p, loaders) => {
        calls++
        return VeliteFile.create(p, loaders)
      })

      await cache.load(a, [jsonLoader])
      await cache.load(b, [jsonLoader])
      strictEqual(calls, 2)

      cache.delete(a)
      await cache.load(a, [jsonLoader])
      strictEqual(calls, 3, 'reloading after delete should call the loader again')
      // b is still cached
      await cache.load(b, [jsonLoader])
      strictEqual(calls, 3, 'b remains cached')

      cache.clear()
      await cache.load(a, [jsonLoader])
      await cache.load(b, [jsonLoader])
      strictEqual(calls, 5, 'both files reload after clear')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reads actual file content when no cache hit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-file-cache-'))
    try {
      const path = join(root, 'data.json')
      await writeFile(path, JSON.stringify({ ok: true }))
      const cache = createFileCache((p, loaders) => VeliteFile.create(p, loaders))
      const file = await cache.load(path, [jsonLoader])
      const onDisk = await readFile(path, 'utf8')
      ok(file.records, 'file records should be populated')
      ok(onDisk.length > 0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
