import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'

import { createAssetStore } from '../../src/assets'
import { createWriter } from '../../src/output/write'

import type { Collections } from '../../src/collections'
import type { OutputState } from '../../src/output/state'
import type { Logger } from '../../src/runtime/logger'

const silentLogger: Logger = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  clear: () => {},
  set: () => {}
}

const noopCopy = async () => {}
const noopWrite = async () => {}

describe('Writer', () => {
  const collections: Collections = {
    posts: { name: 'Post', pattern: 'posts/*.md', schema: {} as never },
    tags: { name: 'Tag', pattern: 'tags/index.yml', single: true, schema: {} as never }
  }

  it('writeEntry produces ESM entry and matching d.ts', async () => {
    const writes: Array<[string, string]> = []
    const state: OutputState = { emitted: new Map() }
    const writer = createWriter({
      writeFile: async (path, content) => {
        writes.push([String(path), String(content)])
      },
      copyFile: noopCopy,
      logger: silentLogger
    })

    await writer.writeEntry(state, '/out', 'esm', '/site/velite.config.ts', collections)

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
    const state: OutputState = { emitted: new Map() }
    const writer = createWriter({
      writeFile: async (path, content) => {
        writes.push([String(path), String(content)])
      },
      copyFile: noopCopy,
      logger: silentLogger
    })

    await writer.writeEntry(state, '/out', 'cjs', '/site/velite.config.ts', collections)
    const [entry] = writes
    ok(entry[1].includes("exports.posts = require('./posts.json')"))
  })

  it('writeData writes one JSON file per collection result', async () => {
    const writes: Array<[string, string]> = []
    const state: OutputState = { emitted: new Map() }
    const writer = createWriter({
      writeFile: async (path, content) => {
        writes.push([String(path), String(content)])
      },
      copyFile: noopCopy,
      logger: silentLogger
    })

    await writer.writeData(state, '/out', {
      posts: [{ title: 'a' }, { title: 'b' }],
      tags: { name: 'x' }
    })

    strictEqual(writes.length, 2)
    const targets = writes.map(([p]) => p).sort()
    deepStrictEqual(targets, ['/out/posts.json', '/out/tags.json'])
  })

  it('writeData skips writes when content matches the emit cache', async () => {
    const writes: string[] = []
    const state: OutputState = { emitted: new Map() }
    const writer = createWriter({
      writeFile: async path => {
        writes.push(String(path))
      },
      copyFile: noopCopy,
      access: async () => {},
      logger: silentLogger
    })

    await writer.writeData(state, '/out', { posts: [{ title: 'a' }] })
    await writer.writeData(state, '/out', { posts: [{ title: 'a' }] })
    strictEqual(writes.length, 1, 'second identical write should be skipped')
  })

  it('writeData emits when a new build session starts with an empty state', async () => {
    const writes: string[] = []
    const state1: OutputState = { emitted: new Map() }
    const writer1 = createWriter({
      writeFile: async path => {
        writes.push(`s1:${path}`)
      },
      copyFile: noopCopy,
      logger: silentLogger
    })
    await writer1.writeData(state1, '/out', { posts: [{ title: 'a' }] })

    // Fresh session = fresh emit state, so the write must happen even though
    // the content is identical to a previous build.
    const state2: OutputState = { emitted: new Map() }
    const writer2 = createWriter({
      writeFile: async path => {
        writes.push(`s2:${path}`)
      },
      copyFile: noopCopy,
      logger: silentLogger
    })
    await writer2.writeData(state2, '/out', { posts: [{ title: 'a' }] })

    deepStrictEqual(writes, ['s1:/out/posts.json', 's2:/out/posts.json'])
  })

  it('writeData skips nullish entries', async () => {
    const writes: string[] = []
    const state: OutputState = { emitted: new Map() }
    const writer = createWriter({
      writeFile: async path => {
        writes.push(String(path))
      },
      copyFile: noopCopy,
      logger: silentLogger
    })

    await writer.writeData(state, '/out', { a: null, b: undefined, c: { x: 1 } })
    deepStrictEqual(writes, ['/out/c.json'])
  })

  it('writeAssets copies every record from the AssetStore', async () => {
    const copies: Array<[string, string]> = []
    const state: OutputState = { emitted: new Map() }
    const writer = createWriter({
      writeFile: noopWrite,
      copyFile: async (src, dst) => {
        copies.push([String(src), String(dst)])
      },
      logger: silentLogger
    })

    const assets = createAssetStore()
    assets.add({
      sourcePath: '/abs/a.png',
      outputName: 'a-1.png'
    })
    assets.add({
      sourcePath: '/abs/b.png',
      outputName: 'b-1.png'
    })

    await writer.writeAssets(state, '/out/static', assets)

    deepStrictEqual(
      copies.sort((a, b) => a[1].localeCompare(b[1])),
      [
        ['/abs/a.png', '/out/static/a-1.png'],
        ['/abs/b.png', '/out/static/b-1.png']
      ]
    )
  })

  it('writeAssets skips copies when the same asset output is already emitted', async () => {
    let copyCount = 0
    const state: OutputState = { emitted: new Map() }
    const writer = createWriter({
      writeFile: noopWrite,
      copyFile: async () => {
        copyCount++
      },
      access: async () => {},
      logger: silentLogger
    })

    const assets = createAssetStore()
    assets.add({
      sourcePath: '/abs/a.png',
      outputName: 'a.png'
    })

    await writer.writeAssets(state, '/out/static', assets)
    await writer.writeAssets(state, '/out/static', assets)

    strictEqual(copyCount, 1, 'second identical asset output should be skipped')
  })
})
