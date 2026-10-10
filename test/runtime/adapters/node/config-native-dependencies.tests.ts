import { deepEqual, ok, rejects, strictEqual } from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createJitiModuleLoader } from '../../../../src/runtime/adapters/node/modules'

import type { TestContext } from 'node:test'

const nativeProject = async (t: TestContext, files: Record<string, string>) => {
  const dir = await mkdtemp(join(tmpdir(), 'velite-deferred-native-'))
  const nativeRequire = createRequire(import.meta.url)
  t.after(async () => {
    for (const name of Object.keys(files)) delete nativeRequire.cache[join(dir, name)]
    await rm(dir, { recursive: true, force: true })
  })
  await Promise.all(Object.entries(files).map(([name, value]) => writeFile(join(dir, name), value)))
  return { dir, nativeRequire }
}

test('native loader returns and refreshes JSON dependencies loaded by a CJS function during evaluation', async t => {
  const { dir } = await nativeProject(t, {
    'velite.config.cts': "const load = require('./helper.cjs')\nmodule.exports = load()\n",
    'helper.cjs': "module.exports = () => require('./settings.json')\n",
    'settings.json': '{"epoch":1}\n'
  })
  const loader = createJitiModuleLoader()
  const config = join(dir, 'velite.config.cts')
  const settings = join(dir, 'settings.json')
  for (const epoch of [1, 2, 3]) {
    await writeFile(settings, JSON.stringify({ epoch }))
    const loaded = await loader.load(config)
    deepEqual(loaded.exports, { epoch })
    deepEqual(loaded.dependencies.slice().sort(), [config, join(dir, 'helper.cjs'), settings].sort())
  }
})

test('native loader rechecks deferred children across a cycle without forgetting watched identities', { timeout: 10000 }, async t => {
  const { dir } = await nativeProject(t, {
    'velite.config.cts': "module.exports = require('./helper.cjs').load()\n",
    'helper.cjs': "exports.load = () => require('./settings.json')\nrequire('./cycle.cjs')\n",
    'cycle.cjs': "module.exports = require('./helper.cjs')\n",
    'settings.json': '{"epoch":1}\n'
  })
  const loader = createJitiModuleLoader()
  const config = join(dir, 'velite.config.cts')
  const settings = join(dir, 'settings.json')
  for (const epoch of [1, 2, 3]) {
    await writeFile(settings, JSON.stringify({ epoch }))
    const loaded = await loader.load(config)
    deepEqual(loaded.exports, { epoch })
    deepEqual(loaded.dependencies.slice().sort(), [config, join(dir, 'helper.cjs'), join(dir, 'cycle.cjs'), settings].sort())
  }
})

test('native loader preserves the original failure and recovers JSON loaded by a pre-cached deferred function', async t => {
  const failedConfig = "const helper = require('./helper.cjs')\nmodule.exports = helper.load()\nthrow helper.failure\n"
  const { dir, nativeRequire } = await nativeProject(t, {
    'velite.config.cts': failedConfig,
    'helper.cjs': "exports.failure = new Error('original deferred failure')\nexports.load = () => require('./settings.json')\n",
    'settings.json': '{"epoch":1}\n'
  })
  const loader = createJitiModuleLoader()
  const config = join(dir, 'velite.config.cts')
  const helper = nativeRequire(join(dir, 'helper.cjs')) as { failure: Error }
  await rejects(loader.load(config), error => error === helper.failure)
  await writeFile(join(dir, 'settings.json'), '{"epoch":2}\n')
  await writeFile(config, "module.exports = require('./helper.cjs').load()\n")
  const recovered = await loader.load(config)
  deepEqual(recovered.exports, { epoch: 2 })
  ok(recovered.dependencies.includes(join(dir, 'settings.json')))
})

test('native loader observes children added after await before completion without consuming concurrent or unrelated modules', { timeout: 10000 }, async t => {
  const { dir, nativeRequire } = await nativeProject(t, {
    'velite.config.cts': '',
    'helper.cjs': "module.exports = () => require('./settings.json')\n",
    'settings.json': '{"epoch":1}\n',
    'other.config.cts': "module.exports = require('./other.cjs')()\n",
    'other.cjs': "module.exports = () => require('./other.json')\n",
    'other.json': '{"epoch":"other"}\n',
    'unrelated.cjs': "module.exports = { token: require('./unrelated.json') }\n",
    'unrelated.json': '{"epoch":"unrelated"}\n'
  })
  const config = join(dir, 'velite.config.cts')
  const enteredEvent = `${dir}:entered`
  const releaseEvent = `${dir}:release`
  t.after(() => {
    process.emit(releaseEvent)
    process.removeAllListeners(enteredEvent)
    process.removeAllListeners(releaseEvent)
  })
  await writeFile(
    config,
    `import { once } from 'node:events'
const load = require('./helper.cjs')
const ready = once(process, ${JSON.stringify(releaseEvent)})
process.emit(${JSON.stringify(enteredEvent)})
await ready
module.exports = load()
`
  )
  const firstLoader = createJitiModuleLoader()
  const secondLoader = createJitiModuleLoader()
  const entered = once(process, enteredEvent)
  const pending = firstLoader.load(config)
  t.after(async () => {
    process.emit(releaseEvent)
    await pending.catch(() => {})
  })
  await entered
  const unrelated = nativeRequire(join(dir, 'unrelated.cjs'))
  const unrelatedJson = nativeRequire(join(dir, 'unrelated.json'))
  const second = await secondLoader.load(join(dir, 'other.config.cts'))
  const other = nativeRequire(join(dir, 'other.cjs'))
  const otherJson = nativeRequire(join(dir, 'other.json'))
  deepEqual(second.exports, { epoch: 'other' })
  process.emit(releaseEvent)
  const first = await pending
  deepEqual(first.exports, { epoch: 1 })
  deepEqual(first.dependencies.slice().sort(), [config, join(dir, 'helper.cjs'), join(dir, 'settings.json')].sort())
  deepEqual(second.dependencies.slice().sort(), [join(dir, 'other.config.cts'), join(dir, 'other.cjs'), join(dir, 'other.json')].sort())

  await writeFile(config, "module.exports = require('./helper.cjs')()\n")
  await writeFile(join(dir, 'settings.json'), '{"epoch":2}\n')
  const reloaded = await firstLoader.load(config)
  deepEqual(reloaded.exports, { epoch: 2 })
  ok(reloaded.dependencies.includes(join(dir, 'settings.json')))
  strictEqual(nativeRequire(join(dir, 'other.cjs')), other)
  strictEqual(nativeRequire(join(dir, 'other.json')), otherJson)
  strictEqual(nativeRequire(join(dir, 'unrelated.cjs')), unrelated)
  strictEqual(nativeRequire(join(dir, 'unrelated.json')), unrelatedJson)
})

test('native loader retains failed-child source and consumed JSON identities with original errors and no callback replay', async t => {
  for (const caught of [false, true])
    await t.test(caught ? 'caught error returns all loaded source dependencies' : 'uncaught error preserves identity and first recovery', async t => {
      const { dir, nativeRequire } = await nativeProject(t, {
        'velite.config.cts': caught
          ? "try { module.exports = require('./helper.cjs').load() } catch (error) { module.exports = { settings: error.settings, failure: error } }\n"
          : "module.exports = require('./helper.cjs').load()\n",
        'helper.cjs': "exports.failure = new Error('original child failure')\nexports.attempts = 0\nexports.load = () => require('./child.cjs')\n",
        'child.cjs':
          "const helper = require('./helper.cjs')\nhelper.attempts++\nconst settings = require('./settings.json')\nthrow Object.assign(helper.failure, { settings })\n",
        'settings.json': '{"epoch":1}\n'
      })
      const config = join(dir, 'velite.config.cts')
      const helperPath = join(dir, 'helper.cjs')
      const childPath = join(dir, 'child.cjs')
      const settings = join(dir, 'settings.json')
      const helper = nativeRequire(helperPath) as { failure: Error; attempts: number }
      const originalJson = nativeRequire(settings)
      const helperModule = nativeRequire.cache[helperPath]!
      const originalChildren = helperModule.children
      const originalRequire = helperModule.require
      const loader = createJitiModuleLoader()
      if (caught) {
        const first = await loader.load(config)
        const value = first.exports as { settings: unknown; failure: Error }
        strictEqual(value.failure, helper.failure)
        strictEqual(value.settings, originalJson)
        deepEqual(value.settings, { epoch: 1 })
        deepEqual(first.dependencies.slice().sort(), [config, helperPath, childPath, settings].sort())
      } else await rejects(loader.load(config), error => error === helper.failure)
      strictEqual(helper.attempts, 1, 'neither configuration callback nor failed child is replayed for observation')
      strictEqual(nativeRequire.cache[childPath], undefined, 'Node still evicts the failed child')
      strictEqual(helperModule.children, originalChildren, 'the original children array is restored, not copied')
      deepEqual(helperModule.children, [], 'Node still removes the failed child edge')
      strictEqual(helperModule.require, originalRequire)
      await writeFile(childPath, "module.exports = require('./settings.json')\n")
      for (const epoch of [2, 3, 4]) {
        await writeFile(settings, JSON.stringify({ epoch }))
        const recovered = await loader.load(config)
        deepEqual(recovered.exports, { epoch })
        deepEqual(recovered.dependencies.slice().sort(), [config, helperPath, childPath, settings].sort())
      }
      strictEqual(helper.attempts, 1, 'previous exports retain their identity and state')
    })
})

test('native loader releases shared Module observation in non-LIFO order and excludes out-of-scope calls', { timeout: 10000 }, async t => {
  const { dir, nativeRequire } = await nativeProject(t, {
    'first.config.cts': '',
    'second.config.cts': '',
    'helper.cjs': "exports.load = () => require('./settings.json')\nexports.unrelated = () => require('./unrelated.json')\n",
    'settings.json': '{"epoch":1}\n',
    'unrelated.json': '{"epoch":"external"}\n'
  })
  const helperPath = join(dir, 'helper.cjs')
  const settings = join(dir, 'settings.json')
  const unrelatedPath = join(dir, 'unrelated.json')
  const helper = nativeRequire(helperPath) as { unrelated: () => unknown }
  const helperModule = nativeRequire.cache[helperPath]!
  const children = helperModule.children
  const descriptor = Object.getOwnPropertyDescriptor(helperModule, 'children')
  const cacheDescriptor = Object.getOwnPropertyDescriptor(nativeRequire.cache, helperPath)
  const originalRequire = helperModule.require
  const pending: Promise<Awaited<ReturnType<ReturnType<typeof createJitiModuleLoader>['load']>>>[] = []
  const events = ['first-entered', 'first-release', 'second-entered', 'second-release'].map(name => `${dir}:${name}`)
  t.after(async () => {
    process.emit(events[1]!)
    process.emit(events[3]!)
    await Promise.allSettled(pending)
    for (const event of events) process.removeAllListeners(event)
  })
  for (const [name, entered, release] of [
    ['first.config.cts', events[0], events[1]],
    ['second.config.cts', events[2], events[3]]
  ] as const)
    await writeFile(
      join(dir, name),
      `import { once } from 'node:events'
const helper = require('./helper.cjs')
const released = once(process, ${JSON.stringify(release)})
process.emit(${JSON.stringify(entered)})
await released
module.exports = helper.load()
`
    )
  const firstLoader = createJitiModuleLoader()
  const secondLoader = createJitiModuleLoader()
  const firstEntered = once(process, events[0]!)
  pending.push(firstLoader.load(join(dir, 'first.config.cts')))
  await firstEntered
  const secondEntered = once(process, events[2]!)
  pending.push(secondLoader.load(join(dir, 'second.config.cts')))
  await secondEntered
  const unrelated = helper.unrelated()
  process.emit(events[1]!)
  const first = await pending[0]!
  process.emit(events[3]!)
  const second = await pending[1]!
  for (const [loaded, name] of [
    [first, 'first.config.cts'],
    [second, 'second.config.cts']
  ] as const) {
    deepEqual(loaded.exports, { epoch: 1 })
    deepEqual(loaded.dependencies.slice().sort(), [join(dir, name), helperPath, settings].sort())
  }
  strictEqual(helperModule.children, children)
  strictEqual(helperModule.require, originalRequire)
  deepEqual(Object.getOwnPropertyDescriptor(helperModule, 'children'), descriptor)
  deepEqual(Object.getOwnPropertyDescriptor(nativeRequire.cache, helperPath), cacheDescriptor)
  await writeFile(join(dir, 'first.config.cts'), "module.exports = require('./helper.cjs').load()\n")
  await writeFile(settings, '{"epoch":2}\n')
  deepEqual((await firstLoader.load(join(dir, 'first.config.cts'))).exports, { epoch: 2 })
  strictEqual(nativeRequire(unrelatedPath), unrelated, 'an external call while both loaders awaited was not consumed or invalidated')
})

test('native loader observes a failed child caught inside an eager helper before that helper import returns', async t => {
  const { dir } = await nativeProject(t, {
    'velite.config.cts': "module.exports = require('./helper.cjs')\n",
    'helper.cjs': "try { module.exports = require('./child.cjs') } catch (error) { module.exports = error.settings }\n",
    'child.cjs': "const settings = require('./settings.json')\nthrow Object.assign(new Error('caught eager child'), { settings })\n",
    'settings.json': '{"epoch":1}\n'
  })
  const loader = createJitiModuleLoader()
  const config = join(dir, 'velite.config.cts')
  const settings = join(dir, 'settings.json')
  for (const epoch of [1, 2, 3]) {
    await writeFile(settings, JSON.stringify({ epoch }))
    const loaded = await loader.load(config)
    deepEqual(loaded.exports, { epoch })
    deepEqual(loaded.dependencies.slice().sort(), [config, join(dir, 'helper.cjs'), join(dir, 'child.cjs'), settings].sort())
  }
})

test('native loader does not consume a helper cache replacement merely written during the original helper evaluation', async t => {
  const { dir, nativeRequire } = await nativeProject(t, {
    'velite.config.cts': "module.exports = require('./helper.cjs')\n",
    'helper.cjs': `module.exports = require('./settings.json')
const { Module } = require('node:module')
const replacement = new Module(__filename)
replacement.filename = __filename
replacement.loaded = true
replacement.exports = { epoch: 'foreign' }
require.cache[__filename] = replacement
`,
    'settings.json': '{"epoch":1}\n'
  })
  const loader = createJitiModuleLoader()
  const config = join(dir, 'velite.config.cts')
  const helperPath = join(dir, 'helper.cjs')
  const first = await loader.load(config)
  deepEqual(first.exports, { epoch: 1 })
  const replacement = nativeRequire.cache[helperPath]!
  deepEqual(replacement.exports, { epoch: 'foreign' })
  await writeFile(join(dir, 'settings.json'), '{"epoch":2}\n')
  const second = await loader.load(config)
  deepEqual(second.exports, { epoch: 'foreign' })
  strictEqual(nativeRequire.cache[helperPath], replacement, 'only the original consumed Module was eligible for first reload invalidation')
})

test('native loader stops observing retained require and import callbacks after configuration evaluation closes', async t => {
  for (const imported of [false, true])
    await t.test(imported ? 'retained import callback' : 'retained require callback', async t => {
      const { dir, nativeRequire } = await nativeProject(t, {
        'velite.config.cts': imported
          ? "module.exports = async () => (await import('./late.cjs')).default\n"
          : "module.exports = () => require('./late.cjs')\n",
        'late.cjs': "module.exports = { cacheAccessor: typeof Object.getOwnPropertyDescriptor(require.cache, __filename).get === 'function' }\n"
      })
      const config = join(dir, 'velite.config.cts')
      const late = join(dir, 'late.cjs')
      const loaded = await createJitiModuleLoader().load(config)
      deepEqual(loaded.dependencies, [config])
      const callback = loaded.exports as () => unknown
      deepEqual(await callback(), { cacheAccessor: false })
      deepEqual(loaded.dependencies, [config], 'post-load work does not reopen configuration tracking')
      strictEqual(Object.getOwnPropertyDescriptor(nativeRequire.cache, late)?.get, undefined)
    })
})

test('native loader retains failed-child provenance from a pre-cached helper-owned createRequire without replay', async t => {
  for (const caught of [false, true])
    await t.test(caught ? 'caught created-require error returns dependencies' : 'uncaught created-require error recovers first fresh JSON', async t => {
      const { dir, nativeRequire } = await nativeProject(t, {
        'velite.config.cts': caught
          ? "try { module.exports = require('./helper.cjs').load() } catch (error) { module.exports = { settings: error.settings, failure: error } }\n"
          : "module.exports = require('./helper.cjs').load()\n",
        'helper.cjs':
          "const native = require('node:module').createRequire(__filename)\nexports.failure = new Error('original created-require child failure')\nexports.attempts = 0\nexports.load = () => native('./child.cjs')\n",
        'child.cjs':
          "const helper = require('./helper.cjs')\nhelper.attempts++\nconst settings = require('./settings.json')\nthrow Object.assign(helper.failure, { settings })\n",
        'settings.json': '{"epoch":1}\n'
      })
      const config = join(dir, 'velite.config.cts')
      const helperPath = join(dir, 'helper.cjs')
      const childPath = join(dir, 'child.cjs')
      const settings = join(dir, 'settings.json')
      const helper = nativeRequire(helperPath) as { failure: Error; attempts: number }
      const originalJson = nativeRequire(settings)
      const loader = createJitiModuleLoader()
      if (caught) {
        const first = await loader.load(config)
        const value = first.exports as { settings: unknown; failure: Error }
        strictEqual(value.failure, helper.failure)
        strictEqual(value.settings, originalJson)
        deepEqual(value.settings, { epoch: 1 })
        deepEqual(first.dependencies.slice().sort(), [config, helperPath, childPath, settings].sort())
      } else await rejects(loader.load(config), error => error === helper.failure)
      strictEqual(helper.attempts, 1, 'the native child and configuration callback each execute once')
      strictEqual(nativeRequire.cache[childPath], undefined, 'native failed-child cleanup remains intact')
      await writeFile(childPath, "module.exports = require('./settings.json')\n")
      for (const epoch of [2, 3, 4]) {
        await writeFile(settings, JSON.stringify({ epoch }))
        const recovered = await loader.load(config)
        deepEqual(recovered.exports, { epoch })
        deepEqual(recovered.dependencies.slice().sort(), [config, helperPath, childPath, settings].sort())
      }
      strictEqual(helper.attempts, 1, 'previous helper exports retain their identity and state')
    })
})

test('native loader releases pending import observation at close without waiting for unrelated module completion', { timeout: 10000 }, async t => {
  const { dir, nativeRequire } = await nativeProject(t, {
    'velite.config.cts': "module.exports = { pending: import('./late.mjs') }\n",
    'late.mjs': ''
  })
  const enteredEvent = `${dir}:entered`
  const releaseEvent = `${dir}:release`
  const entered = once(process, enteredEvent)
  let pending: Promise<unknown> | undefined
  t.after(async () => {
    process.emit(releaseEvent)
    await pending?.catch(() => {})
    process.removeAllListeners(enteredEvent)
    process.removeAllListeners(releaseEvent)
  })
  await writeFile(
    join(dir, 'late.mjs'),
    `import { once } from 'node:events'
const released = once(process, ${JSON.stringify(releaseEvent)})
process.emit(${JSON.stringify(enteredEvent)})
await released
export default 'released'
`
  )
  const loaded = await createJitiModuleLoader().load(join(dir, 'velite.config.cts'))
  pending = (loaded.exports as { pending: Promise<unknown> }).pending
  await entered
  strictEqual(
    typeof Object.getOwnPropertyDescriptor(nativeRequire.cache, join(dir, 'late.mjs'))?.get,
    'undefined',
    'closing evaluation restores pending request slots'
  )
  process.emit(releaseEvent)
  strictEqual(((await pending) as { default: string }).default, 'released')
})

test('native loader isolates concurrent created-require failures and out-of-scope calls on the same helper', { timeout: 10000 }, async t => {
  const { dir, nativeRequire } = await nativeProject(t, {
    'first.config.cts': '',
    'second.config.cts': '',
    'helper.cjs':
      "const native = require('node:module').createRequire(__filename)\nexports.load = () => native('./child.cjs')\nexports.unrelated = () => native('./unrelated.json')\n",
    'child.cjs': "const settings = require('./settings.json')\nthrow Object.assign(new Error('shared created-require failure'), { settings })\n",
    'settings.json': '{"epoch":1}\n',
    'unrelated.json': '{"epoch":"external"}\n'
  })
  const helperPath = join(dir, 'helper.cjs')
  const settings = join(dir, 'settings.json')
  const child = join(dir, 'child.cjs')
  const unrelatedPath = join(dir, 'unrelated.json')
  const helper = nativeRequire(helperPath) as { unrelated: () => unknown }
  const events = ['first-entered', 'first-release', 'second-entered', 'second-release'].map(name => `${dir}:${name}`)
  const pending: Promise<Awaited<ReturnType<ReturnType<typeof createJitiModuleLoader>['load']>>>[] = []
  t.after(async () => {
    process.emit(events[1]!)
    process.emit(events[3]!)
    await Promise.allSettled(pending)
    for (const event of events) process.removeAllListeners(event)
  })
  for (const [name, entered, release] of [
    ['first.config.cts', events[0], events[1]],
    ['second.config.cts', events[2], events[3]]
  ] as const)
    await writeFile(
      join(dir, name),
      `import { once } from 'node:events'
const helper = require('./helper.cjs')
const released = once(process, ${JSON.stringify(release)})
process.emit(${JSON.stringify(entered)})
await released
try { module.exports = helper.load() } catch (error) { module.exports = error.settings }
`
    )
  const firstLoader = createJitiModuleLoader()
  const secondLoader = createJitiModuleLoader()
  const firstEntered = once(process, events[0]!)
  pending.push(firstLoader.load(join(dir, 'first.config.cts')))
  await firstEntered
  const secondEntered = once(process, events[2]!)
  pending.push(secondLoader.load(join(dir, 'second.config.cts')))
  await secondEntered
  const unrelated = helper.unrelated()
  process.emit(events[1]!)
  const first = await pending[0]!
  process.emit(events[3]!)
  const second = await pending[1]!
  for (const [loaded, name] of [
    [first, 'first.config.cts'],
    [second, 'second.config.cts']
  ] as const) {
    deepEqual(loaded.exports, { epoch: 1 })
    deepEqual(loaded.dependencies.slice().sort(), [join(dir, name), helperPath, child, settings].sort())
  }
  await writeFile(settings, '{"epoch":2}\n')
  await writeFile(join(dir, 'first.config.cts'), "try { module.exports = require('./helper.cjs').load() } catch (error) { module.exports = error.settings }\n")
  deepEqual((await firstLoader.load(join(dir, 'first.config.cts'))).exports, { epoch: 2 })
  strictEqual(nativeRequire(unrelatedPath), unrelated, 'created-require work outside both scopes is neither consumed nor invalidated')
})

test('native loader does not alias a created-require parent filename to an unconsumed replacement Module', async t => {
  const { dir, nativeRequire } = await nativeProject(t, {
    'velite.config.cts': "try { module.exports = require('./helper.cjs').load() } catch (error) { module.exports = error.settings }\n",
    'helper.cjs': `const { createRequire, Module } = require('node:module')
const native = createRequire(__filename)
exports.load = () => {
  const replacement = new Module(__filename)
  replacement.filename = __filename
  replacement.loaded = true
  replacement.exports = { load: () => ({ epoch: 'foreign' }) }
  require.cache[__filename] = replacement
  return native('./child.cjs')
}
`,
    'child.cjs': "const settings = require('./settings.json')\nthrow Object.assign(new Error('created-require parent identity'), { settings })\n",
    'settings.json': '{"epoch":1}\n'
  })
  const config = join(dir, 'velite.config.cts')
  const helper = join(dir, 'helper.cjs')
  const settings = join(dir, 'settings.json')
  const loader = createJitiModuleLoader()
  const first = await loader.load(config)
  deepEqual(first.exports, { epoch: 1 })
  deepEqual(first.dependencies.slice().sort(), [config, helper, join(dir, 'child.cjs'), settings].sort())
  const replacement = nativeRequire.cache[helper]!
  await writeFile(settings, '{"epoch":2}\n')
  deepEqual((await loader.load(config)).exports, { epoch: 'foreign' })
  strictEqual(nativeRequire.cache[helper], replacement, 'the synthetic require owner is not the helper filename cache replacement')
})

test('native loader preserves frozen pre-cached Module exports and original failures without replaying their source', async t => {
  const { dir, nativeRequire } = await nativeProject(t, {
    'velite.config.cts': "module.exports = require('./helper.cjs').token\n",
    'helper.cjs': "exports.token = {}\nexports.failure = new Error('frozen original failure')\nexports.load = () => require('./child.cjs')\n",
    'child.cjs': "const settings = require('./settings.json')\nthrow Object.assign(require('./helper.cjs').failure, { settings })\n",
    'settings.json': '{"epoch":1}\n'
  })
  const config = join(dir, 'velite.config.cts')
  const helperPath = join(dir, 'helper.cjs')
  const childPath = join(dir, 'child.cjs')
  const settings = join(dir, 'settings.json')
  const helper = nativeRequire(helperPath) as { token: unknown; failure: Error }
  const originalJson = nativeRequire(settings)
  const helperModule = nativeRequire.cache[helperPath]!
  const jsonModule = nativeRequire.cache[settings]!
  Object.freeze(helperModule)
  Object.freeze(jsonModule)
  const first = await createJitiModuleLoader().load(config)
  strictEqual(first.exports, helper.token, 'observation must not cause a native import to fall back to re-evaluation')
  strictEqual(nativeRequire.cache[helperPath], helperModule)
  await writeFile(config, "module.exports = require('./helper.cjs').load()\n")
  const loader = createJitiModuleLoader()
  await rejects(loader.load(config), error => error === helper.failure)
  strictEqual((helper.failure as Error & { settings: unknown }).settings, originalJson)
  strictEqual(nativeRequire.cache[childPath], undefined)
  strictEqual(helperModule.require, nativeRequire.cache[helperPath]!.require)
  await writeFile(childPath, "module.exports = require('./settings.json')\n")
  await writeFile(settings, '{"epoch":2}\n')
  const recovered = await loader.load(config)
  deepEqual(recovered.exports, { epoch: 2 })
  deepEqual(recovered.dependencies.slice().sort(), [config, helperPath, childPath, settings].sort())
  deepEqual(originalJson, { epoch: 1 }, 'frozen cached JSON and old exports are not rewritten')
})

test('native loader observes the actual failed target of a pre-cached createRequire with custom owner paths', async t => {
  const { dir, nativeRequire } = await nativeProject(t, {
    'velite.config.cts': "try { module.exports = require('./helper.cjs').load() } catch (error) { module.exports = error.settings }\n",
    'helper.cjs':
      "const native = require('node:module').createRequire(__filename)\nconst owner = native('./bridge.cjs').parent\nowner.paths = [__dirname]\nexports.load = () => native('choice')\n",
    'bridge.cjs': 'exports.parent = module.parent\n',
    'choice.js': "const settings = require('./settings.json')\nthrow Object.assign(new Error('custom-path child failed'), { settings })\n",
    'settings.json': '{"epoch":1}\n'
  })
  const config = join(dir, 'velite.config.cts')
  const helper = join(dir, 'helper.cjs')
  const child = join(dir, 'choice.js')
  const settings = join(dir, 'settings.json')
  nativeRequire(helper)
  const originalJson = nativeRequire(settings)
  const loaded = await createJitiModuleLoader().load(config)
  strictEqual(loaded.exports, originalJson, 'the native request uses its real synthetic owner paths')
  strictEqual(nativeRequire.cache[child], undefined, 'Node removes the failed target before final graph traversal')
  deepEqual(loaded.dependencies.slice().sort(), [config, helper, child, settings].sort())
})

const nativeModules = await import('node:module')
if (typeof nativeModules.registerHooks === 'function')
  test('native dependency observation preserves a public resolve hook outcome and invocation count', async t => {
    const { dir } = await nativeProject(t, {
      'velite.config.cts': "module.exports = require('./helper.cjs').load()\n",
      'helper.cjs': "const native = require('node:module').createRequire(__filename)\nexports.load = () => native('std01-observed-choice')\n",
      'first.cjs': 'module.exports = { epoch: 1 }\n',
      'second.cjs': 'module.exports = { epoch: 2 }\n'
    })
    const { pathToFileURL } = await import('node:url')
    createRequire(import.meta.url)(join(dir, 'helper.cjs'))
    let calls = 0
    const hooks = nativeModules.registerHooks({
      resolve(id, context, nextResolve) {
        if (id !== 'std01-observed-choice') return nextResolve(id, context)
        return { url: pathToFileURL(join(dir, ++calls === 1 ? 'first.cjs' : 'second.cjs')).href, shortCircuit: true }
      }
    })
    t.after(() => hooks.deregister())
    deepEqual(createRequire(join(dir, 'separate-baseline', 'owner.cjs'))('std01-observed-choice'), { epoch: 1 })
    strictEqual(calls, 1, 'the unobserved native call invokes its public resolver once')
    calls = 0
    const loaded = await createJitiModuleLoader().load(join(dir, 'velite.config.cts'))
    deepEqual(loaded.exports, { epoch: 1 }, 'watch tracking must not select a different module')
    strictEqual(calls, 1, 'observation does not rerun consumer resolution hooks')
    ok(loaded.dependencies.includes(join(dir, 'first.cjs')))
  })

test('native loader excludes an installed package entire native subtree while tracking subsequent direct local imports', async t => {
  const { dir, nativeRequire } = await nativeProject(t, {
    'velite.config.cts': "module.exports = { installed: require('./helper.cjs')(), direct: require('./direct.json') }\n",
    'helper.cjs': "module.exports = () => require('config-token')\n",
    'outside.cjs': "module.exports = { settings: require('./settings.json') }\n",
    'settings.json': '{"epoch":1}\n',
    'direct.json': '{"epoch":1}\n'
  })
  const { mkdir } = await import('node:fs/promises')
  const installedDir = join(dir, 'node_modules/config-token')
  const installed = join(installedDir, 'index.cjs')
  const settings = join(dir, 'settings.json')
  const direct = join(dir, 'direct.json')
  const config = join(dir, 'velite.config.cts')
  await mkdir(installedDir, { recursive: true })
  await writeFile(join(installedDir, 'package.json'), '{"name":"config-token","main":"index.cjs"}\n')
  await writeFile(installed, "module.exports = require('../../outside.cjs')\n")
  t.after(() => {
    delete nativeRequire.cache[installed]
  })
  const loader = createJitiModuleLoader()
  const first = await loader.load(config)
  deepEqual(first.exports, { installed: { settings: { epoch: 1 } }, direct: { epoch: 1 } })
  ok(first.dependencies.includes(direct), 'installed exclusion must end before the subsequent direct local import')
  ok(!first.dependencies.includes(join(dir, 'outside.cjs')))
  ok(!first.dependencies.includes(settings), 'local descendants of an excluded installed package are not config dependencies')
  const originalModule = nativeRequire.cache[settings]
  const originalJson = nativeRequire(settings)
  const originalPackage = nativeRequire(installed)
  for (const epoch of [2, 3]) {
    await writeFile(settings, JSON.stringify({ epoch }))
    await writeFile(direct, JSON.stringify({ epoch }))
    const loaded = await loader.load(config)
    const value = loaded.exports as { installed: unknown; direct: unknown }
    strictEqual(value.installed, originalPackage)
    strictEqual(nativeRequire.cache[settings], originalModule, 'root reload must not evict an installed-subtree descendant')
    strictEqual(nativeRequire(settings), originalJson)
    deepEqual(value.direct, { epoch })
    ok(loaded.dependencies.includes(direct))
    ok(!loaded.dependencies.includes(settings))
  }
})

test('native loader interposes native loading only during evaluation and restores the original methods', async t => {
  const { dir } = await nativeProject(t, {
    'velite.config.cts': "module.exports = require('./helper.cjs')()\n",
    'helper.cjs': "module.exports = () => require('./settings.json')\n",
    'settings.json': '{"epoch":1}\n'
  })
  const { Module } = await import('node:module')
  const loadDescriptor = Object.getOwnPropertyDescriptor(Module, '_load')
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(Module.prototype, 'load')
  ok(loadDescriptor && prototypeDescriptor, 'the supported runtimes expose the interposed native loading entries')
  const loader = createJitiModuleLoader()
  const loaded = await loader.load(join(dir, 'velite.config.cts'))
  deepEqual(loaded.exports, { epoch: 1 })
  strictEqual(Object.getOwnPropertyDescriptor(Module, '_load')?.value, loadDescriptor.value, 'Module._load must be restored after evaluation closes')
  strictEqual(
    Object.getOwnPropertyDescriptor(Module.prototype, 'load')?.value,
    prototypeDescriptor.value,
    'Module.prototype.load must be restored after evaluation closes'
  )
  deepEqual(Object.getOwnPropertyDescriptor(Module, '_load'), loadDescriptor, 'the restored Module._load descriptor keeps its original flags')
  deepEqual(Object.getOwnPropertyDescriptor(Module.prototype, 'load'), prototypeDescriptor, 'the restored prototype load descriptor keeps its original flags')
})
