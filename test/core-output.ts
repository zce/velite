import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'

import { createAssetStore } from '../src/core/assets'
import { createOutputWriter } from '../src/core/output'
import { createOutputState } from '../src/core/output-state'

import type { Logger } from '../src/core/logger'
import type { Collections } from '../src/types'

const silentLogger: Logger = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  clear: () => {},
  set: () => {}
}

describe('OutputWriter', () => {
  const collections: Collections = {
    posts: { name: 'Post', pattern: 'posts/*.md', schema: {} as never },
    tags: { name: 'Tag', pattern: 'tags/index.yml', single: true, schema: {} as never }
  }

  it('writeEntry produces ESM entry and matching d.ts', async () => {
    const writes: Array<[string, string]> = []
    const state = createOutputState()
    const writer = createOutputWriter(state, {
      writeFile: (async (path, content) => {
        writes.push([String(path), String(content)])
      }) as never,
      copyFile: (async () => {}) as never,
      logger: silentLogger
    })

    await writer.writeEntry('/out', 'esm', '/site/velite.config.ts', collections)

    strictEqual(writes.length, 2)
    const [entry, dts] = writes
    ok(entry[0].endsWith('index.js'))
    ok(entry[1].includes("from './posts.json' with { type: 'json' }"))
    ok(entry[1].includes("from './tags.json' with { type: 'json' }"))
    ok(dts[0].endsWith('index.d.ts'))
    ok(dts[1].includes('import type __vc from'))
    ok(dts[1].includes('export declare const posts: Post[]'))
    ok(dts[1].includes('export declare const tags: Tag\n'))
  })

  it('writeEntry uses CJS exports when format is cjs', async () => {
    const writes: Array<[string, string]> = []
    const writer = createOutputWriter(createOutputState(), {
      writeFile: (async (path, content) => {
        writes.push([String(path), String(content)])
      }) as never,
      copyFile: (async () => {}) as never,
      logger: silentLogger
    })

    await writer.writeEntry('/out', 'cjs', '/site/velite.config.ts', collections)
    const [entry] = writes
    ok(entry[1].includes("exports.posts = require('./posts.json')"))
  })

  it('writeData writes one JSON file per collection result', async () => {
    const writes: Array<[string, string]> = []
    const writer = createOutputWriter(createOutputState(), {
      writeFile: (async (path, content) => {
        writes.push([String(path), String(content)])
      }) as never,
      copyFile: (async () => {}) as never,
      logger: silentLogger
    })

    await writer.writeData('/out', {
      posts: [{ title: 'a' }, { title: 'b' }],
      tags: { name: 'x' }
    })

    strictEqual(writes.length, 2)
    const targets = writes.map(([p]) => p).sort()
    deepStrictEqual(targets, ['/out/posts.json', '/out/tags.json'])
  })

  it('writeData skips writes when content matches the emit cache', async () => {
    const writes: string[] = []
    const state = createOutputState()
    const writer = createOutputWriter(state, {
      writeFile: (async path => {
        writes.push(String(path))
      }) as never,
      copyFile: (async () => {}) as never,
      access: (async () => {}) as never,
      logger: silentLogger
    })

    await writer.writeData('/out', { posts: [{ title: 'a' }] })
    await writer.writeData('/out', { posts: [{ title: 'a' }] })
    strictEqual(writes.length, 1, 'second identical write should be skipped')
  })

  it('writeData emits when a new build session starts with an empty state', async () => {
    const writes: string[] = []
    const state1 = createOutputState()
    const writer1 = createOutputWriter(state1, {
      writeFile: (async path => {
        writes.push(`s1:${path}`)
      }) as never,
      copyFile: (async () => {}) as never,
      logger: silentLogger
    })
    await writer1.writeData('/out', { posts: [{ title: 'a' }] })

    // Fresh session = fresh emit state, so the write must happen even though
    // the content is identical to a previous build.
    const state2 = createOutputState()
    const writer2 = createOutputWriter(state2, {
      writeFile: (async path => {
        writes.push(`s2:${path}`)
      }) as never,
      copyFile: (async () => {}) as never,
      logger: silentLogger
    })
    await writer2.writeData('/out', { posts: [{ title: 'a' }] })

    deepStrictEqual(writes, ['s1:/out/posts.json', 's2:/out/posts.json'])
  })

  it('writeData writes null entries and skips only undefined entries', async () => {
    const writes: string[] = []
    const writer = createOutputWriter(createOutputState(), {
      writeFile: (async path => {
        writes.push(String(path))
      }) as never,
      copyFile: (async () => {}) as never,
      logger: silentLogger
    })

    await writer.writeData('/out', { a: null, b: undefined, c: { x: 1 } })
    deepStrictEqual(writes, ['/out/a.json', '/out/c.json'])
  })

  it('writeAssets copies every record from the AssetStore', async () => {
    const copies: Array<[string, string]> = []
    const writer = createOutputWriter(createOutputState(), {
      writeFile: (async () => {}) as never,
      copyFile: (async (src, dst) => {
        copies.push([String(src), String(dst)])
      }) as never,
      logger: silentLogger
    })

    const assets = createAssetStore()
    assets.add({
      sourcePath: '/abs/a.png',
      outputName: 'a-1.png',
      publicUrl: '/static/a-1.png',
      ownerFile: '/site/x.md'
    })
    assets.add({
      sourcePath: '/abs/b.png',
      outputName: 'b-1.png',
      publicUrl: '/static/b-1.png',
      ownerFile: '/site/x.md'
    })

    await writer.writeAssets('/out/static', assets)

    deepStrictEqual(
      copies.sort((a, b) => a[1].localeCompare(b[1])),
      [
        ['/abs/a.png', '/out/static/a-1.png'],
        ['/abs/b.png', '/out/static/b-1.png']
      ]
    )
  })

  it('writeAssets always copies (no asset emit cache)', async () => {
    let copyCount = 0
    const state = createOutputState()
    const writer = createOutputWriter(state, {
      writeFile: (async () => {}) as never,
      copyFile: (async () => {
        copyCount++
      }) as never,
      logger: silentLogger
    })

    const assets = createAssetStore()
    assets.add({
      sourcePath: '/abs/a.png',
      outputName: 'a.png',
      publicUrl: '/static/a.png',
      ownerFile: '/site/x.md'
    })

    await writer.writeAssets('/out/static', assets)
    await writer.writeAssets('/out/static', assets)

    strictEqual(copyCount, 2, 'asset writes always copy, even with shared output state')
  })
})
