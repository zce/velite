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
