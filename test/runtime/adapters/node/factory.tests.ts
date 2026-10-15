import { deepEqual, ok, rejects, strictEqual } from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createJitiModuleLoader, createNodeFileSystem, createNodeSchemaContextHost, createSharpImageProcessor } from '../../../../src/runtime/adapters/node'
import * as nodeAdapters from '../../../../src/runtime/adapters/node'

test('node adapter barrel exposes individual adapter factories, not a runtime bundle', () => {
  strictEqual('createNodeRuntime' in nodeAdapters, false)
  strictEqual('nodeRuntime' in nodeAdapters, false)
  strictEqual('createNodeContextStorage' in nodeAdapters, false, 'old createNodeContextStorage removed')
  strictEqual(typeof nodeAdapters.createNodeFileSystem, 'function')
  strictEqual(typeof nodeAdapters.createJitiModuleLoader, 'function')
  strictEqual(typeof nodeAdapters.createNodeSchemaContextHost, 'function')
  strictEqual(typeof nodeAdapters.createSharpImageProcessor, 'function')
})

test('node adapter factories return individual adapter objects', () => {
  strictEqual(typeof createNodeFileSystem().read, 'function')
  strictEqual(typeof createJitiModuleLoader().load, 'function')
  strictEqual(typeof createNodeSchemaContextHost().run, 'function')
  strictEqual(typeof createSharpImageProcessor().probe, 'function')
})

test('jiti module loader unwraps default exports and reports local dependencies', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'velite-jiti-loader-'))
  const configPath = join(dir, 'velite.config.ts')
  const dependencyPath = join(dir, 'shared.ts')
  await writeFile(dependencyPath, `export const collections = { posts: { pattern: '*.md', schema: 'schema' } }\n`)
  await writeFile(configPath, `import { collections } from './shared'\nexport default { collections }\n`)

  try {
    const loader = createJitiModuleLoader()
    const loaded = await loader.load(configPath)
    deepEqual(loaded.exports, { collections: { posts: { pattern: '*.md', schema: 'schema' } } })
    ok(loaded.dependencies.includes(dependencyPath), `expected dependencies to include ${dependencyPath}, got ${loaded.dependencies.join(', ')}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('jiti module loader reloads configuration and local TypeScript dependencies without dropping dependency tracking', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'velite-jiti-reload-'))
  const configPath = join(dir, 'velite.config.ts')
  const dependencyPath = join(dir, 'shared.ts')
  try {
    const loader = createJitiModuleLoader()
    await writeFile(dependencyPath, 'export const epoch = 1\n')
    await writeFile(configPath, "import { epoch } from './shared'\nexport default { epoch, target: 'first' }\n")
    const first = await loader.load(configPath)
    deepEqual(first.exports, { epoch: 1, target: 'first' })
    ok(first.dependencies.includes(dependencyPath))
    await writeFile(dependencyPath, 'export const epoch = 2\n')
    await writeFile(configPath, "import { epoch } from './shared'\nexport default { epoch, target: 'second' }\n")
    const second = await loader.load(configPath)
    deepEqual(second.exports, { epoch: 2, target: 'second' })
    ok(second.dependencies.includes(dependencyPath))
    deepEqual((await loader.load(configPath)).exports, second.exports)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('jiti module loader keeps local JSON dependencies watched and fresh on reload', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'velite-jiti-json-'))
  const configPath = join(dir, 'velite.config.ts')
  const dependencyPath = join(dir, 'settings.json')
  try {
    const loader = createJitiModuleLoader()
    await writeFile(configPath, "import settings from './settings.json'\nexport default settings\n")
    await writeFile(dependencyPath, '{"epoch":1}\n')
    const first = await loader.load(configPath)
    deepEqual(first.exports, { epoch: 1 })
    ok(first.dependencies.includes(dependencyPath))
    await writeFile(dependencyPath, '{"epoch":2}\n')
    const second = await loader.load(configPath)
    deepEqual(second.exports, { epoch: 2 })
    ok(second.dependencies.includes(dependencyPath))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('jiti configuration reload does not invalidate unrelated modules loaded during top-level await', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'velite-jiti-isolation-'))
  const configPath = join(dir, 'velite.config.ts')
  const unrelatedPath = join(dir, 'unrelated.cjs')
  const unrelatedJson = join(dir, 'unrelated.json')
  const enteredEvent = `${dir}:entered`
  const releaseEvent = `${dir}:release`
  const nativeRequire = createRequire(import.meta.url)
  try {
    await writeFile(unrelatedPath, "module.exports = { token: require('./unrelated.json') }\n")
    await writeFile(unrelatedJson, '{"epoch":"unrelated"}\n')
    await writeFile(
      configPath,
      `import { once } from 'node:events'\nimport process from 'node:process'\nconst ready = once(process, ${JSON.stringify(releaseEvent)})\nprocess.emit(${JSON.stringify(enteredEvent)})\nawait ready\nexport default { epoch: 1 }\n`
    )
    const loader = createJitiModuleLoader()
    const entered = once(process, enteredEvent)
    const loading = loader.load(configPath)
    await entered
    const unrelated = nativeRequire(unrelatedPath)
    const unrelatedSettings = nativeRequire(unrelatedJson)
    process.emit(releaseEvent)
    const first = await loading
    await writeFile(configPath, 'export default { epoch: 2 }\n')
    deepEqual((await loader.load(configPath)).exports, { epoch: 2 })
    strictEqual(nativeRequire(unrelatedPath), unrelated, 'an unrelated application module must keep its native identity')
    strictEqual(nativeRequire(unrelatedJson), unrelatedSettings, 'unrelated native JSON must keep its identity too')
    strictEqual(first.dependencies.includes(unrelatedPath), false, 'only actual config dependencies are watched')
    strictEqual(first.dependencies.includes(unrelatedJson), false)
  } finally {
    process.emit(releaseEvent)
    process.removeAllListeners(enteredEvent)
    process.removeAllListeners(releaseEvent)
    delete nativeRequire.cache[unrelatedPath]
    delete nativeRequire.cache[unrelatedJson]
    await rm(dir, { recursive: true, force: true })
  }
})

test('jiti module loader tracks and reloads an externally pre-cached JSON through a TypeScript helper', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'velite-jiti-cached-json-'))
  const configPath = join(dir, 'velite.config.ts')
  const helperPath = join(dir, 'shared.ts')
  const dependencyPath = join(dir, 'settings.json')
  const nativeRequire = createRequire(import.meta.url)
  try {
    await writeFile(dependencyPath, '{"epoch":1}\n')
    deepEqual(nativeRequire(dependencyPath), { epoch: 1 })
    await writeFile(helperPath, "import settings from './settings.json'\nexport default settings\n")
    await writeFile(configPath, "import settings from './shared'\nexport default settings\n")
    const loader = createJitiModuleLoader()
    const first = await loader.load(configPath)
    deepEqual(first.exports, { epoch: 1 })
    ok(first.dependencies.includes(helperPath))
    ok(first.dependencies.includes(dependencyPath))
    await writeFile(dependencyPath, '{"epoch":2}\n')
    const second = await loader.load(configPath)
    deepEqual(second.exports, { epoch: 2 })
    ok(second.dependencies.includes(helperPath))
    ok(second.dependencies.includes(dependencyPath))
  } finally {
    delete nativeRequire.cache[dependencyPath]
    await rm(dir, { recursive: true, force: true })
  }
})

test('jiti module loader does not evict a native dependency entry replaced by another caller', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'velite-jiti-cache-identity-'))
  const configPath = join(dir, 'velite.config.ts')
  const dependencyPath = join(dir, 'settings.json')
  const nativeRequire = createRequire(import.meta.url)
  try {
    await writeFile(configPath, "import settings from './settings.json'\nexport default settings\n")
    await writeFile(dependencyPath, '{"epoch":1}\n')
    const loader = createJitiModuleLoader()
    deepEqual((await loader.load(configPath)).exports, { epoch: 1 })
    await writeFile(dependencyPath, '{"epoch":2}\n')
    delete nativeRequire.cache[dependencyPath]
    const replacement = nativeRequire(dependencyPath)
    deepEqual((await loader.load(configPath)).exports, { epoch: 2 })
    strictEqual(nativeRequire(dependencyPath), replacement, 'the observed old cache entry must not invalidate its replacement')
  } finally {
    delete nativeRequire.cache[dependencyPath]
    await rm(dir, { recursive: true, force: true })
  }
})

test('jiti module loader keeps actual native dependencies fresh after a failed config load', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'velite-jiti-failed-'))
  const configPath = join(dir, 'velite.config.ts')
  const dependencyPath = join(dir, 'settings.json')
  const nativeRequire = createRequire(import.meta.url)
  try {
    const loader = createJitiModuleLoader()
    await writeFile(dependencyPath, '{"epoch":1}\n')
    await writeFile(configPath, "import settings from './settings.json'\nthrow new Error('invalid config')\nexport default settings\n")
    await rejects(loader.load(configPath), /invalid config/)
    await writeFile(dependencyPath, '{"epoch":2}\n')
    await writeFile(configPath, "import settings from './settings.json'\nexport default settings\n")
    const loaded = await loader.load(configPath)
    deepEqual(loaded.exports, { epoch: 2 })
    ok(loaded.dependencies.includes(dependencyPath))
  } finally {
    delete nativeRequire.cache[dependencyPath]
    await rm(dir, { recursive: true, force: true })
  }
})

test('jiti module loader re-evaluates every supported config extension, including top-level await', async t => {
  for (const extension of ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts'])
    await t.test(extension, async () => {
      const dir = await mkdtemp(join(tmpdir(), 'velite-jiti-extension-'))
      const configPath = join(dir, `velite.config.${extension}`)
      const source = (epoch: number) =>
        extension === 'cjs' || extension === 'cts' ? `module.exports = { epoch: ${epoch} }\n` : `export default { epoch: await Promise.resolve(${epoch}) }\n`
      try {
        const loader = createJitiModuleLoader()
        await writeFile(configPath, source(1))
        deepEqual((await loader.load(configPath)).exports, { epoch: 1 })
        await writeFile(configPath, source(2))
        deepEqual((await loader.load(configPath)).exports, { epoch: 2 })
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    })
})
