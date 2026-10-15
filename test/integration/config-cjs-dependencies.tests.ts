import { deepEqual, rejects, strictEqual } from 'node:assert/strict'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

import type { BuildResult } from '../../src/index'

test('packaged Builder watches and refreshes native CJS transitive JSON configuration dependencies', async t => {
  for (const preCached of [false, true])
    await t.test(preCached ? 'externally pre-cached JSON child' : 'initially uncached JSON child', async t => {
      const config = `
const { defineConfig, s } = require('velite')
const settings = require('./helper.cjs')
module.exports = defineConfig({ collections: { posts: {
  pattern: '*.json',
  schema: s.object({ title: s.string() }).transform(value => ({ ...value, epoch: settings.epoch, installed: settings.installed }))
} } })
`
      const project = await contentProject(t, config, { 'post.json': '{"title":"Entry"}\n' })
      const configPath = join(project.dir, 'velite.config.cts')
      const helperPath = join(project.dir, 'helper.cjs')
      const settingsPath = join(project.dir, 'settings.json')
      const unrelatedPath = join(project.dir, 'unrelated.cjs')
      const unrelatedJson = join(project.dir, 'unrelated.json')
      const packageDir = join(project.dir, 'node_modules/velite-config-token')
      const packagePath = join(packageDir, 'index.cjs')
      const packageJson = join(packageDir, 'token.json')
      const nativeRequire = createRequire(import.meta.url)
      const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
      t.after(async () => {
        await instance.dispose()
        for (const path of [helperPath, settingsPath, unrelatedPath, unrelatedJson, packagePath, packageJson]) delete nativeRequire.cache[path]
      })
      await rename(join(project.dir, 'velite.config.mjs'), configPath)
      await mkdir(packageDir, { recursive: true })
      await Promise.all([
        writeFile(
          helperPath,
          "const settings = require('./settings.json')\nconst installed = require('velite-config-token')\nmodule.exports = { epoch: settings.epoch, installed: installed.name }\n"
        ),
        writeFile(settingsPath, '{"epoch":1}\n'),
        writeFile(unrelatedPath, "module.exports = { token: require('./unrelated.json') }\n"),
        writeFile(unrelatedJson, '{"name":"unrelated"}\n'),
        writeFile(join(packageDir, 'package.json'), '{"name":"velite-config-token","type":"commonjs","main":"index.cjs"}\n'),
        writeFile(packagePath, "module.exports = { name: 'package', token: require('./token.json') }\n"),
        writeFile(packageJson, '{"name":"package token"}\n')
      ])
      if (preCached) deepEqual(nativeRequire(settingsPath), { epoch: 1 })
      const unrelated = nativeRequire(unrelatedPath)
      const unrelatedToken = nativeRequire(unrelatedJson)
      const installed = nativeRequire(packagePath)
      const installedToken = nativeRequire(packageJson)
      const assertNativeIdentity = () => {
        strictEqual(nativeRequire(unrelatedPath), unrelated, 'unrelated CJS keeps its native identity')
        strictEqual(nativeRequire(unrelatedJson), unrelatedToken, 'unrelated JSON keeps its native identity')
        strictEqual(nativeRequire(packagePath), installed, 'installed CJS keeps its native identity')
        strictEqual(nativeRequire(packageJson), installedToken, 'installed transitive JSON keeps its native identity')
      }
      const data = (result: BuildResult | undefined) => result?.output.collections.posts?.entries.map(entry => entry.data)
      const readData = async () => JSON.parse(await project.read('.velite/posts.json'))
      const first = await instance.build({ layout: 'single' })
      deepEqual(first.diagnostics, [])
      deepEqual(data(first), [{ title: 'Entry', epoch: 1, installed: 'package' }])
      deepEqual(await readData(), [{ title: 'Entry', epoch: 1, installed: 'package' }])
      strictEqual(await instance.apply([{ type: 'change', absPath: unrelatedJson }]), undefined, 'unrelated files outside content are ignored')

      for (const { json, expected } of [
        { json: '{"epoch":2}\n', expected: [{ title: 'Entry', epoch: 2, installed: 'package' }] },
        { json: '{"epoch":3}\n', expected: [{ title: 'Entry', epoch: 3, installed: 'package' }] }
      ]) {
        await writeFile(settingsPath, json)
        const changed = await instance.apply([{ type: 'change', absPath: settingsPath }])
        const changedJson = await readData()
        const reloaded = await instance.apply([{ type: 'change', absPath: configPath }])
        const reloadedJson = await readData()
        assertNativeIdentity()
        deepEqual(
          { change: data(changed), changeJson: changedJson, rootReload: data(reloaded), rootReloadJson: reloadedJson },
          { change: expected, changeJson: expected, rootReload: expected, rootReloadJson: expected },
          'a transitive JSON change must rebuild with fresh values; an explicit root reload must not retain the old JSON either'
        )
        deepEqual(changed!.diagnostics, [])
        deepEqual(reloaded!.diagnostics, [])
      }

      await writeFile(configPath, `${config}\nthrow new Error('invalid config')\n`)
      await rejects(instance.apply([{ type: 'change', absPath: configPath }]), /invalid config/)
      deepEqual(await readData(), [{ title: 'Entry', epoch: 3, installed: 'package' }], 'a failed config load does not replace published output')
      assertNativeIdentity()
      await writeFile(settingsPath, '{"epoch":4}\n')
      await writeFile(configPath, config)
      const recovered = await instance.apply([{ type: 'change', absPath: configPath }])
      deepEqual(recovered!.diagnostics, [])
      deepEqual(data(recovered), [{ title: 'Entry', epoch: 4, installed: 'package' }])
      deepEqual(await readData(), [{ title: 'Entry', epoch: 4, installed: 'package' }])
      assertNativeIdentity()

      await writeFile(settingsPath, '{"epoch":5}\n')
      const changedAfterRecovery = await instance.apply([{ type: 'change', absPath: settingsPath }])
      deepEqual(data(changedAfterRecovery), [{ title: 'Entry', epoch: 5, installed: 'package' }], 'recovered transitive dependencies remain watched')
      deepEqual(changedAfterRecovery!.diagnostics, [])
      deepEqual(await readData(), [{ title: 'Entry', epoch: 5, installed: 'package' }])
      assertNativeIdentity()

      await writeFile(settingsPath, '{"epoch":6}\n')
      delete nativeRequire.cache[settingsPath]
      const replacement = nativeRequire(settingsPath)
      const replaced = await instance.apply([{ type: 'change', absPath: configPath }])
      deepEqual(replaced!.diagnostics, [])
      deepEqual(data(replaced), [{ title: 'Entry', epoch: 6, installed: 'package' }])
      deepEqual(await readData(), [{ title: 'Entry', epoch: 6, installed: 'package' }])
      strictEqual(nativeRequire(settingsPath), replacement, 'config reload must not evict a transitive native entry replaced by another caller')
      assertNativeIdentity()
    })
})

test('packaged Builder recovers fresh transitive JSON after a native CJS helper throws', async t => {
  const project = await contentProject(
    t,
    `const { s } = require('velite')
const settings = require('./helper.cjs')
module.exports = { collections: { posts: { pattern: '*.json', schema: s.object({ title: s.string() }).transform(value => ({ ...value, epoch: settings.epoch })) } } }
`,
    { 'post.json': '{"title":"Entry"}\n' }
  )
  const configPath = join(project.dir, 'velite.config.cts')
  const helperPath = join(project.dir, 'helper.cjs')
  const siblingPath = join(project.dir, 'sibling.cjs')
  const settingsPath = join(project.dir, 'settings.json')
  const nativeRequire = createRequire(import.meta.url)
  const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
  t.after(async () => {
    await instance.dispose()
    for (const path of [helperPath, siblingPath, settingsPath]) delete nativeRequire.cache[path]
  })
  await rename(join(project.dir, 'velite.config.mjs'), configPath)
  await Promise.all([
    writeFile(settingsPath, '{"epoch":1}\n'),
    writeFile(siblingPath, "module.exports = require('./settings.json')\n"),
    writeFile(helperPath, "const settings = require('./sibling.cjs')\nthrow new Error('invalid helper')\nmodule.exports = settings\n")
  ])
  await rejects(instance.build({ layout: 'single' }), /invalid helper/)
  await writeFile(settingsPath, '{"epoch":2}\n')
  await writeFile(helperPath, "module.exports = require('./sibling.cjs')\n")
  const recovered = await instance.build({ layout: 'single' })
  deepEqual(recovered.diagnostics, [])
  deepEqual(
    recovered.output.collections.posts!.entries.map(entry => entry.data),
    [{ title: 'Entry', epoch: 2 }]
  )
  deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 2 }])
  await writeFile(settingsPath, '{"epoch":3}\n')
  const changed = await instance.apply([{ type: 'change', absPath: settingsPath }])
  deepEqual(
    changed?.output.collections.posts!.entries.map(entry => entry.data),
    [{ title: 'Entry', epoch: 3 }]
  )
  deepEqual(changed!.diagnostics, [])
  deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 3 }])
  const reloaded = await instance.apply([{ type: 'change', absPath: configPath }])
  deepEqual(reloaded!.diagnostics, [])
  deepEqual(
    reloaded?.output.collections.posts!.entries.map(entry => entry.data),
    [{ title: 'Entry', epoch: 3 }]
  )
  deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 3 }])
})

test('packaged Builder watches replaced JSON below a pre-cached CJS helper without evicting the replacement', async t => {
  const project = await contentProject(
    t,
    `const { s } = require('velite')
const settings = require('./helper.cjs')
module.exports = { collections: { posts: { pattern: '*.json', schema: s.object({ title: s.string() }).transform(value => ({ ...value, epoch: settings.epoch })) } } }
`,
    { 'post.json': '{"title":"Entry"}\n' }
  )
  const configPath = join(project.dir, 'velite.config.cts')
  const helperPath = join(project.dir, 'helper.cjs')
  const settingsPath = join(project.dir, 'settings.json')
  const nativeRequire = createRequire(import.meta.url)
  const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
  t.after(async () => {
    await instance.dispose()
    for (const path of [helperPath, settingsPath]) delete nativeRequire.cache[path]
  })
  await rename(join(project.dir, 'velite.config.mjs'), configPath)
  await Promise.all([writeFile(settingsPath, '{"epoch":1}\n'), writeFile(helperPath, "module.exports = require('./settings.json')\n")])
  const cachedHelper = nativeRequire(helperPath)
  deepEqual(cachedHelper, { epoch: 1 })
  await writeFile(settingsPath, '{"epoch":2}\n')
  delete nativeRequire.cache[settingsPath]
  const replacement = nativeRequire(settingsPath)
  deepEqual(replacement, { epoch: 2 })
  strictEqual(nativeRequire(helperPath), cachedHelper, 'the pre-cached helper still retains its original dependency value')
  deepEqual(nativeRequire(helperPath), { epoch: 1 })

  const first = await instance.build({ layout: 'single' })
  deepEqual(first.diagnostics, [])
  deepEqual(
    first.output.collections.posts!.entries.map(entry => entry.data),
    [{ title: 'Entry', epoch: 1 }]
  )
  deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 1 }])
  strictEqual(nativeRequire(settingsPath), replacement, 'the initial config load does not evict a replacement owned by another caller')

  await writeFile(settingsPath, '{"epoch":2}\n')
  const changed = await instance.apply([{ type: 'change', absPath: settingsPath }])
  strictEqual(nativeRequire(settingsPath), replacement, 'refreshing the helper must not evict the replacement JSON it had not previously consumed')
  deepEqual(
    { change: changed?.output.collections.posts!.entries.map(entry => entry.data), json: JSON.parse(await project.read('.velite/posts.json')) },
    { change: [{ title: 'Entry', epoch: 2 }], json: [{ title: 'Entry', epoch: 2 }] },
    'an actual used child remains a watched source even when its native cache entry has been replaced'
  )
  deepEqual(changed!.diagnostics, [])
})

test('packaged Builder refreshes a JSON identity consumed by a fresh CJS helper even when a later cached helper retains its old identity', async t => {
  const project = await contentProject(
    t,
    `const { s } = require('velite')
const fresh = require('./fresh.cjs')
const cached = require('./cached.cjs')
module.exports = { collections: { posts: { pattern: '*.json', schema: s.object({ title: s.string() }).transform(value => ({ ...value, fresh: fresh.epoch, cached: cached.epoch })) } } }
`,
    { 'post.json': '{"title":"Entry"}\n' }
  )
  const configPath = join(project.dir, 'velite.config.cts')
  const freshPath = join(project.dir, 'fresh.cjs')
  const cachedPath = join(project.dir, 'cached.cjs')
  const settingsPath = join(project.dir, 'settings.json')
  const nativeRequire = createRequire(import.meta.url)
  const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
  t.after(async () => {
    await instance.dispose()
    for (const path of [freshPath, cachedPath, settingsPath]) delete nativeRequire.cache[path]
  })
  await rename(join(project.dir, 'velite.config.mjs'), configPath)
  await Promise.all([
    writeFile(settingsPath, '{"epoch":1}\n'),
    writeFile(freshPath, "module.exports = require('./settings.json')\n"),
    writeFile(cachedPath, "module.exports = require('./settings.json')\n")
  ])
  const cached = nativeRequire(cachedPath)
  deepEqual(cached, { epoch: 1 })
  await writeFile(settingsPath, '{"epoch":2}\n')
  delete nativeRequire.cache[settingsPath]
  const replacement = nativeRequire(settingsPath)
  deepEqual(replacement, { epoch: 2 })
  const first = await instance.build({ layout: 'single' })
  deepEqual(first.diagnostics, [])
  deepEqual(
    first.output.collections.posts!.entries.map(entry => entry.data),
    [{ title: 'Entry', fresh: 2, cached: 1 }]
  )
  deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', fresh: 2, cached: 1 }])
  strictEqual(nativeRequire(settingsPath), replacement, "initial observation does not replace another caller's current identity")

  for (const epoch of [3, 4]) {
    await writeFile(settingsPath, JSON.stringify({ epoch }))
    const changed = await instance.apply([{ type: 'change', absPath: settingsPath }])
    deepEqual(
      { data: changed?.output.collections.posts!.entries.map(entry => entry.data), json: JSON.parse(await project.read('.velite/posts.json')) },
      { data: [{ title: 'Entry', fresh: epoch, cached: epoch }], json: [{ title: 'Entry', fresh: epoch, cached: epoch }] },
      'a later observation of an old child must not forget that the actual current JSON Module was also consumed by this load'
    )
    deepEqual(changed!.diagnostics, [])
    const forced = await instance.apply([{ type: 'change', absPath: configPath }])
    deepEqual(
      forced!.output.collections.posts!.entries.map(entry => entry.data),
      [{ title: 'Entry', fresh: epoch, cached: epoch }]
    )
    deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', fresh: epoch, cached: epoch }])
    deepEqual(forced!.diagnostics, [])
  }
  deepEqual(cached, { epoch: 1 }, 'independently retained old exports are not revoked')
  deepEqual(replacement, { epoch: 2 }, 'invalidating a consumed cache entry does not mutate independently retained exports')
})

test('packaged Builder watches JSON required by a CJS function during configuration evaluation', async t => {
  const project = await contentProject(
    t,
    `const { s } = require('velite')
const settings = require('./helper.cjs')()
module.exports = { collections: { posts: { pattern: '*.json', schema: s.object({ title: s.string() }).transform(value => ({ ...value, epoch: settings.epoch })) } } }
`,
    { 'post.json': '{"title":"Entry"}\n' }
  )
  const configPath = join(project.dir, 'velite.config.cts')
  const helperPath = join(project.dir, 'helper.cjs')
  const settingsPath = join(project.dir, 'settings.json')
  const nativeRequire = createRequire(import.meta.url)
  const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
  t.after(async () => {
    await instance.dispose()
    for (const path of [helperPath, settingsPath]) delete nativeRequire.cache[path]
  })
  await rename(join(project.dir, 'velite.config.mjs'), configPath)
  await Promise.all([writeFile(settingsPath, '{"epoch":1}\n'), writeFile(helperPath, "module.exports = () => require('./settings.json')\n")])
  const data = (result: BuildResult | undefined) => result?.output.collections.posts?.entries.map(entry => entry.data)
  const readData = async () => JSON.parse(await project.read('.velite/posts.json'))
  const first = await instance.build({ layout: 'single' })
  deepEqual(first.diagnostics, [])
  deepEqual(data(first), [{ title: 'Entry', epoch: 1 }])
  deepEqual(await readData(), [{ title: 'Entry', epoch: 1 }])

  for (const { changedEpoch, rootEpoch, expectedChange, expectedRoot } of [
    { changedEpoch: 2, rootEpoch: 3, expectedChange: [{ title: 'Entry', epoch: 2 }], expectedRoot: [{ title: 'Entry', epoch: 3 }] },
    { changedEpoch: 4, rootEpoch: 5, expectedChange: [{ title: 'Entry', epoch: 4 }], expectedRoot: [{ title: 'Entry', epoch: 5 }] }
  ]) {
    await writeFile(settingsPath, JSON.stringify({ epoch: changedEpoch }))
    const changed = await instance.apply([{ type: 'change', absPath: settingsPath }])
    const changedJson = await readData()
    await writeFile(settingsPath, JSON.stringify({ epoch: rootEpoch }))
    const reloaded = await instance.apply([{ type: 'change', absPath: configPath }])
    const reloadedJson = await readData()
    deepEqual(
      { change: data(changed), changeJson: changedJson, rootReload: data(reloaded), rootReloadJson: reloadedJson },
      { change: expectedChange, changeJson: expectedChange, rootReload: expectedRoot, rootReloadJson: expectedRoot },
      'JSON loaded by the helper function before config evaluation completes must be watched and invalidated on both child and root changes'
    )
    deepEqual(changed!.diagnostics, [])
    deepEqual(reloaded!.diagnostics, [])
  }
})

test('packaged Builder recovers fresh deferred JSON after configuration calls a CJS function and then throws', async t => {
  const config = `const { s } = require('velite')
const settings = require('./helper.cjs')()
module.exports = { collections: { posts: { pattern: '*.json', schema: s.object({ title: s.string() }).transform(value => ({ ...value, epoch: settings.epoch })) } } }
`
  const project = await contentProject(t, `${config}\nthrow new Error('invalid deferred config')\n`, { 'post.json': '{"title":"Entry"}\n' })
  const configPath = join(project.dir, 'velite.config.cts')
  const helperPath = join(project.dir, 'helper.cjs')
  const settingsPath = join(project.dir, 'settings.json')
  const nativeRequire = createRequire(import.meta.url)
  const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
  t.after(async () => {
    await instance.dispose()
    for (const path of [helperPath, settingsPath]) delete nativeRequire.cache[path]
  })
  await rename(join(project.dir, 'velite.config.mjs'), configPath)
  await Promise.all([writeFile(settingsPath, '{"epoch":1}\n'), writeFile(helperPath, "module.exports = () => require('./settings.json')\n")])
  await rejects(instance.build({ layout: 'single' }), /invalid deferred config/)
  await writeFile(settingsPath, '{"epoch":2}\n')
  await writeFile(configPath, config)
  const recovered = await instance.build({ layout: 'single' })
  deepEqual(recovered.diagnostics, [])
  deepEqual(
    { data: recovered.output.collections.posts!.entries.map(entry => entry.data), json: JSON.parse(await project.read('.velite/posts.json')) },
    { data: [{ title: 'Entry', epoch: 2 }], json: [{ title: 'Entry', epoch: 2 }] },
    'a failed evaluation must retain deferred child identities for fresh recovery, not reuse JSON loaded before the throw'
  )
  await writeFile(settingsPath, '{"epoch":3}\n')
  const changed = await instance.apply([{ type: 'change', absPath: settingsPath }])
  deepEqual(changed!.diagnostics, [])
  deepEqual(
    changed!.output.collections.posts!.entries.map(entry => entry.data),
    [{ title: 'Entry', epoch: 3 }]
  )
  deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 3 }])
  await writeFile(settingsPath, '{"epoch":4}\n')
  const reloaded = await instance.apply([{ type: 'change', absPath: configPath }])
  deepEqual(reloaded!.diagnostics, [])
  deepEqual(
    reloaded!.output.collections.posts!.entries.map(entry => entry.data),
    [{ title: 'Entry', epoch: 4 }]
  )
  deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 4 }])
})

test('packaged Builder recovers fresh JSON after a deferred CJS child reads it and fails initialization', async t => {
  const project = await contentProject(
    t,
    `const { s } = require('velite')
const settings = require('./helper.cjs')()
module.exports = { collections: { posts: { pattern: '*.json', schema: s.object({ title: s.string() }).transform(value => ({ ...value, epoch: settings.epoch })) } } }
`,
    { 'post.json': '{"title":"Entry"}\n' }
  )
  const configPath = join(project.dir, 'velite.config.cts')
  const helperPath = join(project.dir, 'helper.cjs')
  const childPath = join(project.dir, 'child.cjs')
  const settingsPath = join(project.dir, 'settings.json')
  const nativeRequire = createRequire(import.meta.url)
  const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
  t.after(async () => {
    await instance.dispose()
    for (const path of [helperPath, childPath, settingsPath]) delete nativeRequire.cache[path]
  })
  await rename(join(project.dir, 'velite.config.mjs'), configPath)
  await Promise.all([
    writeFile(helperPath, "module.exports = () => require('./child.cjs')\n"),
    writeFile(childPath, "const settings = require('./settings.json')\nthrow Object.assign(new Error('deferred child failed'), { settings })\n"),
    writeFile(settingsPath, '{"epoch":1}\n')
  ])
  await rejects(instance.build({ layout: 'single' }), /deferred child failed/)

  await writeFile(settingsPath, '{"epoch":2}\n')
  await writeFile(childPath, "module.exports = require('./settings.json')\n")
  const recovered = await instance.build({ layout: 'single' })
  deepEqual(recovered.diagnostics, [])
  deepEqual(
    recovered.output.collections.posts!.entries.map(entry => entry.data),
    [{ title: 'Entry', epoch: 2 }]
  )
  deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 2 }])

  await writeFile(settingsPath, '{"epoch":3}\n')
  const changed = await instance.apply([{ type: 'change', absPath: settingsPath }])
  deepEqual(
    changed?.output.collections.posts!.entries.map(entry => entry.data),
    [{ title: 'Entry', epoch: 3 }]
  )
  deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 3 }])
  deepEqual(changed!.diagnostics, [])

  await writeFile(settingsPath, '{"epoch":4}\n')
  const forced = await instance.apply([{ type: 'change', absPath: configPath }])
  deepEqual(
    forced?.output.collections.posts!.entries.map(entry => entry.data),
    [{ title: 'Entry', epoch: 4 }]
  )
  deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 4 }])
  deepEqual(forced!.diagnostics, [])
})

test('packaged Builder watches JSON consumed by a failed child when configuration catches its original error', async t => {
  for (const afterAwait of [false, true])
    await t.test(afterAwait ? 'failed child after await' : 'synchronous failed child', async t => {
      const project = await contentProject(
        t,
        `const { s } = require('velite')
const load = require('./helper.cjs')
${afterAwait ? 'await Promise.resolve()' : ''}
let settings
try { settings = load() } catch (error) { settings = error.settings }
module.exports = { collections: { posts: { pattern: '*.json', schema: s.object({ title: s.string() }).transform(value => ({ ...value, epoch: settings.epoch })) } } }
`,
        { 'post.json': '{"title":"Entry"}\n' }
      )
      const configPath = join(project.dir, 'velite.config.cts')
      const helperPath = join(project.dir, 'helper.cjs')
      const childPath = join(project.dir, 'child.cjs')
      const settingsPath = join(project.dir, 'settings.json')
      const nativeRequire = createRequire(import.meta.url)
      const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
      t.after(async () => {
        await instance.dispose()
        for (const path of [helperPath, childPath, settingsPath]) delete nativeRequire.cache[path]
      })
      await rename(join(project.dir, 'velite.config.mjs'), configPath)
      await Promise.all([
        writeFile(helperPath, "module.exports = () => require('./child.cjs')\n"),
        writeFile(childPath, "const settings = require('./settings.json')\nthrow Object.assign(new Error('caught child failure'), { settings })\n"),
        writeFile(settingsPath, '{"epoch":1}\n')
      ])
      const first = await instance.build({ layout: 'single' })
      deepEqual(first.diagnostics, [])
      deepEqual(
        first.output.collections.posts!.entries.map(entry => entry.data),
        [{ title: 'Entry', epoch: 1 }]
      )
      deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 1 }])

      for (const [epoch, eventPath] of [
        [2, settingsPath],
        [3, configPath],
        [4, settingsPath],
        [5, configPath]
      ] as const) {
        await writeFile(settingsPath, JSON.stringify({ epoch }))
        const changed = await instance.apply([{ type: 'change', absPath: eventPath }])
        deepEqual(
          changed?.output.collections.posts!.entries.map(entry => entry.data),
          [{ title: 'Entry', epoch }]
        )
        deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch }])
        deepEqual(changed!.diagnostics, [])
      }
    })
})

test('packaged Builder does not observe native imports started by a schema after configuration evaluation closes', async t => {
  for (const asynchronous of [false, true])
    await t.test(asynchronous ? 'asynchronous schema callback' : 'synchronous schema callback', async t => {
      const project = await contentProject(
        t,
        `const { s } = require('velite')
module.exports = { collections: { posts: { pattern: '*.json', schema: s.object({ title: s.string() }).transform(${asynchronous ? 'async ' : ''}value => ({ ...value, cacheAccessor: require('./late.cjs').cacheAccessor })) } } }
`,
        { 'post.json': '{"title":"Entry"}\n' }
      )
      const configPath = join(project.dir, 'velite.config.cts')
      const latePath = join(project.dir, 'late.cjs')
      const nativeRequire = createRequire(import.meta.url)
      const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
      t.after(async () => {
        await instance.dispose()
        delete nativeRequire.cache[latePath]
      })
      await rename(join(project.dir, 'velite.config.mjs'), configPath)
      await writeFile(latePath, "module.exports = { cacheAccessor: typeof Object.getOwnPropertyDescriptor(require.cache, __filename).get === 'function' }\n")
      const first = await instance.build({ layout: 'single' })
      deepEqual(first.diagnostics, [])
      deepEqual(
        first.output.collections.posts!.entries.map(entry => entry.data),
        [{ title: 'Entry', cacheAccessor: false }]
      )
      deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', cacheAccessor: false }])
      strictEqual(Object.getOwnPropertyDescriptor(nativeRequire.cache, latePath)?.get, undefined)
      strictEqual(await instance.apply([{ type: 'change', absPath: latePath }]), undefined, 'post-load imports are not configuration-time dependencies')
    })
})

test('packaged Builder watches a failed child source through repair and repeated failure without unrelated events', async t => {
  const project = await contentProject(
    t,
    `const { s } = require('velite')
let settings
try { settings = require('./helper.cjs')() } catch (error) { settings = error.settings }
module.exports = { collections: { posts: { pattern: '*.json', schema: s.object({ title: s.string() }).transform(value => ({ ...value, epoch: settings.epoch })) } } }
`,
    { 'post.json': '{"title":"Entry"}\n' }
  )
  const configPath = join(project.dir, 'velite.config.cts')
  const helperPath = join(project.dir, 'helper.cjs')
  const childPath = join(project.dir, 'child.cjs')
  const settingsPath = join(project.dir, 'settings.json')
  const nativeRequire = createRequire(import.meta.url)
  const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
  t.after(async () => {
    await instance.dispose()
    for (const path of [helperPath, childPath, settingsPath]) delete nativeRequire.cache[path]
  })
  await rename(join(project.dir, 'velite.config.mjs'), configPath)
  const failure = "const settings = require('./settings.json')\nthrow Object.assign(new Error('child failed'), { settings })\n"
  await Promise.all([
    writeFile(helperPath, "module.exports = () => require('./child.cjs')\n"),
    writeFile(childPath, failure),
    writeFile(settingsPath, '{"epoch":1}\n')
  ])
  const first = await instance.build({ layout: 'single' })
  deepEqual(first.diagnostics, [])
  deepEqual(
    first.output.collections.posts!.entries.map(entry => entry.data),
    [{ title: 'Entry', epoch: 1 }]
  )
  deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 1 }])

  for (const [epoch, source, eventPath] of [
    [2, "module.exports = require('./settings.json')\n", childPath],
    [3, "module.exports = require('./settings.json')\n// edited again\n", childPath],
    [4, undefined, configPath],
    [5, failure, childPath],
    [6, undefined, settingsPath]
  ] as const) {
    await writeFile(settingsPath, JSON.stringify({ epoch }))
    if (source !== undefined) await writeFile(childPath, source)
    const changed = await instance.apply([{ type: 'change', absPath: eventPath }])
    deepEqual(
      changed?.output.collections.posts!.entries.map(entry => entry.data),
      [{ title: 'Entry', epoch }]
    )
    deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch }])
    deepEqual(changed!.diagnostics, [])
  }
})

test('packaged Builder keeps the non-failing deferred nested CJS control fresh on JSON and independent root changes', async t => {
  const project = await contentProject(
    t,
    `const { s } = require('velite')
const settings = require('./helper.cjs')()
module.exports = { collections: { posts: { pattern: '*.json', schema: s.object({ title: s.string() }).transform(value => ({ ...value, epoch: settings.epoch })) } } }
`,
    { 'post.json': '{"title":"Entry"}\n' }
  )
  const configPath = join(project.dir, 'velite.config.cts')
  const helperPath = join(project.dir, 'helper.cjs')
  const childPath = join(project.dir, 'child.cjs')
  const settingsPath = join(project.dir, 'settings.json')
  const nativeRequire = createRequire(import.meta.url)
  const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
  t.after(async () => {
    await instance.dispose()
    for (const path of [helperPath, childPath, settingsPath]) delete nativeRequire.cache[path]
  })
  await rename(join(project.dir, 'velite.config.mjs'), configPath)
  await Promise.all([
    writeFile(helperPath, "module.exports = () => require('./child.cjs')\n"),
    writeFile(childPath, "module.exports = require('./settings.json')\n"),
    writeFile(settingsPath, '{"epoch":1}\n')
  ])
  const first = await instance.build({ layout: 'single' })
  deepEqual(first.diagnostics, [])
  deepEqual(
    first.output.collections.posts!.entries.map(entry => entry.data),
    [{ title: 'Entry', epoch: 1 }]
  )
  deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 1 }])
  for (const [epoch, eventPath] of [
    [2, settingsPath],
    [3, configPath],
    [4, settingsPath]
  ] as const) {
    await writeFile(settingsPath, JSON.stringify({ epoch }))
    const changed = await instance.apply([{ type: 'change', absPath: eventPath }])
    deepEqual(
      changed?.output.collections.posts!.entries.map(entry => entry.data),
      [{ title: 'Entry', epoch }]
    )
    deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch }])
    deepEqual(changed!.diagnostics, [])
  }
})

test('packaged Builder observes failed children loaded by a helper-owned createRequire during complete configuration evaluation', async t => {
  for (const [caught, afterAwait] of [
    [false, false],
    [true, false],
    [true, true]
  ])
    await t.test(caught ? (afterAwait ? 'caught after await' : 'caught synchronously') : 'uncaught first recovery', async t => {
      const project = await contentProject(
        t,
        `const { s } = require('velite')
const load = require('./helper.cjs')
${afterAwait ? 'await Promise.resolve()' : ''}
${caught ? 'let settings; try { settings = load() } catch (error) { settings = error.settings }' : 'const settings = load()'}
module.exports = { collections: { posts: { pattern: '*.json', schema: s.object({ title: s.string() }).transform(value => ({ ...value, epoch: settings.epoch })) } } }
`,
        { 'post.json': '{"title":"Entry"}\n' }
      )
      const configPath = join(project.dir, 'velite.config.cts')
      const helperPath = join(project.dir, 'helper.cjs')
      const childPath = join(project.dir, 'child.cjs')
      const settingsPath = join(project.dir, 'settings.json')
      const nativeRequire = createRequire(import.meta.url)
      const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
      t.after(async () => {
        await instance.dispose()
        for (const path of [helperPath, childPath, settingsPath]) delete nativeRequire.cache[path]
      })
      await rename(join(project.dir, 'velite.config.mjs'), configPath)
      const failure = "const settings = require('./settings.json')\nthrow Object.assign(new Error('created-require child failed'), { settings })\n"
      const success = "module.exports = require('./settings.json')\n"
      await Promise.all([
        writeFile(helperPath, "const native = require('node:module').createRequire(__filename)\nmodule.exports = () => native('./child.cjs')\n"),
        writeFile(childPath, failure),
        writeFile(settingsPath, '{"epoch":1}\n')
      ])
      const assertData = async (result: BuildResult | undefined, epoch: number) => {
        deepEqual(
          result?.output.collections.posts!.entries.map(entry => entry.data),
          [{ title: 'Entry', epoch }]
        )
        deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch }])
        deepEqual(result!.diagnostics, [])
      }
      if (caught) await assertData(await instance.build({ layout: 'single' }), 1)
      else {
        await rejects(instance.build({ layout: 'single' }), /created-require child failed/)
        await writeFile(settingsPath, '{"epoch":2}\n')
        await writeFile(childPath, success)
        await assertData(await instance.build({ layout: 'single' }), 2)
      }
      for (const [epoch, source, eventPath] of caught
        ? ([
            [2, undefined, settingsPath],
            [3, undefined, configPath],
            [4, success, childPath],
            [5, failure, childPath],
            [6, undefined, settingsPath],
            [7, success, childPath]
          ] as const)
        : ([
            [3, undefined, settingsPath],
            [4, undefined, configPath],
            [5, `${success}// edited again\n`, childPath]
          ] as const)) {
        await writeFile(settingsPath, JSON.stringify({ epoch }))
        if (source !== undefined) await writeFile(childPath, source)
        await assertData(await instance.apply([{ type: 'change', absPath: eventPath }]), epoch)
      }
    })
})

test('packaged Builder preserves an installed package local descendants while refreshing direct config JSON', async t => {
  const project = await contentProject(
    t,
    `const { s } = require('velite')
const settings = require('config-token')
const direct = require('./direct.json')
module.exports = { collections: { posts: { pattern: '*.json', schema: s.object({ title: s.string() }).transform(value => ({ ...value, epoch: settings.epoch, direct: direct.epoch })) } } }
`,
    { 'post.json': '{"title":"Entry"}\n' }
  )
  const configPath = join(project.dir, 'velite.config.cts')
  const packageDir = join(project.dir, 'node_modules/config-token')
  const packagePath = join(packageDir, 'index.cjs')
  const outsidePath = join(project.dir, 'outside.cjs')
  const settingsPath = join(project.dir, 'settings.json')
  const directPath = join(project.dir, 'direct.json')
  const nativeRequire = createRequire(import.meta.url)
  const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
  t.after(async () => {
    await instance.dispose()
    for (const path of [packagePath, outsidePath, settingsPath, directPath]) delete nativeRequire.cache[path]
  })
  await rename(join(project.dir, 'velite.config.mjs'), configPath)
  await mkdir(packageDir, { recursive: true })
  await Promise.all([
    writeFile(join(packageDir, 'package.json'), '{"name":"config-token","main":"index.cjs"}\n'),
    writeFile(packagePath, "module.exports = require('../../outside.cjs')\n"),
    writeFile(outsidePath, "module.exports = require('./settings.json')\n"),
    writeFile(settingsPath, '{"epoch":1}\n'),
    writeFile(directPath, '{"epoch":1}\n')
  ])
  const assertData = async (result: BuildResult | undefined, direct: number) => {
    deepEqual(
      result?.output.collections.posts!.entries.map(entry => entry.data),
      [{ title: 'Entry', epoch: 1, direct }]
    )
    deepEqual(JSON.parse(await project.read('.velite/posts.json')), [{ title: 'Entry', epoch: 1, direct }])
    deepEqual(result!.diagnostics, [])
  }
  await assertData(await instance.build({ layout: 'single' }), 1)
  const originalJson = nativeRequire(settingsPath)
  const originalModules = [packagePath, outsidePath, settingsPath].map(path => nativeRequire.cache[path])
  for (const direct of [2, 3]) {
    await writeFile(settingsPath, JSON.stringify({ epoch: direct }))
    strictEqual(await instance.apply([{ type: 'change', absPath: settingsPath }]), undefined, 'installed-subtree JSON is not a watched config input')
    for (const [index, path] of [packagePath, outsidePath, settingsPath].entries()) strictEqual(nativeRequire.cache[path], originalModules[index])
    strictEqual(nativeRequire(settingsPath), originalJson)
    await writeFile(directPath, JSON.stringify({ epoch: direct }))
    await assertData(await instance.apply([{ type: 'change', absPath: directPath }]), direct)
    await assertData(await instance.apply([{ type: 'change', absPath: configPath }]), direct)
    for (const [index, path] of [packagePath, outsidePath, settingsPath].entries()) strictEqual(nativeRequire.cache[path], originalModules[index])
    strictEqual(nativeRequire(settingsPath), originalJson)
  }
})
