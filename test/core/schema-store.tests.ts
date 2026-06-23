// SessionStore (SchemaContext.store): unit contract + cross-record sharing.
import { deepEqual, equal, ok } from 'node:assert/strict'
import { test } from 'node:test'

import { createBuilder, s } from '../../src/core'
import { context, createSessionStore } from '../../src/core/schema/context'
import { join } from '../../src/core/util/path'
import { nodeContextStorage, silentLogger } from '../../src/runtime/adapters/node'
import { MemoryFileSystem } from '../helpers/memory-fs'

import type { UserConfig } from '../../src/core/config'
import type { Runtime } from '../../src/runtime'

test('SessionStore: get/has/getOrCreate share state by key (no set)', () => {
  const store = createSessionStore()
  equal(store.has('k'), false)
  equal(store.get('k'), undefined)
  const v = store.getOrCreate('k', () => ({ n: 0 }))
  v.n += 1
  equal(store.has('k'), true)
  equal(store.get<{ n: number }>('k')!.n, 1)
  // getOrCreate returns the existing value and does not re-invoke create
  let created = 0
  const same = store.getOrCreate('k', () => {
    created++
    return { n: 99 }
  })
  equal(created, 0, 'getOrCreate must not re-create an existing key')
  equal(same.n, 1)
})

test('SchemaContext.store: is shared across records within one build', async () => {
  const counter = (key: string) =>
    s.string().transform<string>(async value => {
      const { store } = context()
      const shared = store.getOrCreate<{ n: number }>(key, () => ({ n: 0 }))
      shared.n += 1
      return `${value}#${shared.n}`
    })
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: counter('posts-counter') }) } }
  }
  const CWD = '/proj'
  const fs = new MemoryFileSystem()
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }, { title: 'C' }]))
  const runtime: Runtime = {
    contextStorage: nodeContextStorage,
    fs,
    modules: { load: async () => ({ exports: config, dependencies: [] }) },
    logger: silentLogger
  }
  const result = await createBuilder({ runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') }).build({ layout: 'single' })
  equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics))
  const posts = JSON.parse(new TextDecoder().decode(await fs.read(join(CWD, '.velite/posts.json')))) as Array<{ title: string }>
  deepEqual(
    posts.map(p => p.title),
    ['A#1', 'B#2', 'C#3']
  )
})
