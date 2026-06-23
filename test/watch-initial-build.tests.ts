// Public watch() must run the initial build exactly once and route its
// result through the WatchHandle. A regression earlier had the entry watch()
// call `instance.build()` and `instance.watch()` (which itself called
// build()), doubling prepare/side-effects on startup. The new contract:
// Builder.watch() returns { initial, close } and src/index.ts uses that
// initial result for strict handling instead of building again.
//
// A companion facade-level test lives in test/integration/watch-facade.tests.ts
// — it drives the public `src/index.ts` `watch()` against a real temp project
// so a regression in the facade itself (not just Builder.watch()) is caught.
import { equal, ok } from 'node:assert/strict'
import { test } from 'node:test'

import { createBuilder, s } from '../src/core'
import { join } from '../src/core/util/path'
import { nodeContextStorage, silentLogger } from '../src/runtime/adapters/node'
import { MemoryFileSystem } from './helpers/memory-fs'
import { noopImageProcessor } from './helpers/runtime'

import type { PrepareHook, UserConfig } from '../src/core/config'
import type { TestRuntime } from './helpers/runtime'

test('Builder.watch(): runs the initial build exactly once and exposes its result', async () => {
  const CWD = '/proj'
  let prepareCalls = 0
  const prepare: PrepareHook = () => {
    prepareCalls++
    return undefined
  }
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } },
    prepare
  }
  const fs = new MemoryFileSystem()
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }]))
  const runtime: TestRuntime = {
    contextStorage: nodeContextStorage,
    fs,
    modules: { load: async () => ({ exports: config, dependencies: [] }) },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: () => ({ subscribe: () => () => {} })
  }
  const builder = createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })
  const handle = await builder.watch({}, { layout: 'single' })

  // Initial build ran exactly once; handle carries its BuildResult.
  equal(prepareCalls, 1, `prepare was invoked ${prepareCalls} times on watch() startup; expected 1`)
  ok(handle.initial !== undefined, 'WatchHandle.initial is populated')
  ok(handle.initial.written.length > 0, 'initial build wrote output')
  equal(handle.initial.diagnostics.length, 0)
  await handle.close()
  await builder.dispose()
})

test('Builder.watch(): watches config dependencies and classifies their events as config reloads', async () => {
  const CWD = '/proj'
  const configPath = join(CWD, 'velite.config.ts')
  const configDependency = join(CWD, 'velite.shared.ts')
  const config: UserConfig = {
    root: 'content',
    collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } }
  }
  const fs = new MemoryFileSystem()
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }]))
  fs.put(configPath, '// config')
  fs.put(configDependency, '// shared config dependency')
  let loadCalls = 0
  let subscribedPaths: string[] = []
  const runtime: TestRuntime = {
    contextStorage: nodeContextStorage,
    fs,
    modules: {
      load: async () => {
        loadCalls++
        return { exports: config, dependencies: [configPath, configDependency] }
      }
    },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: paths => {
      subscribedPaths = paths
      return { subscribe: () => () => {} }
    }
  }

  const builder = createBuilder({ ...runtime, cwd: CWD, configPath })
  const handle = await builder.watch({}, { layout: 'single' })

  ok(subscribedPaths.includes(join(CWD, 'content')), 'content root is watched')
  ok(subscribedPaths.includes(configPath), 'config file is watched')
  ok(subscribedPaths.includes(configDependency), 'config dependency is watched')

  const result = await builder.apply([{ type: 'change', absPath: configDependency }])
  ok(result !== undefined, 'config dependency change triggers a rebuild')
  equal(loadCalls, 2, 'config dependency change reloads the config session')

  await handle.close()
  await builder.dispose()
})
