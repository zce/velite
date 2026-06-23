import { deepEqual, ok, strictEqual } from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createJitiModuleLoader, createNodeContextStorage, createNodeFileSystem, createSharpImageProcessor } from '../../../../src/runtime/adapters/node'
import * as nodeAdapters from '../../../../src/runtime/adapters/node'

test('node adapter barrel exposes individual adapter factories, not a runtime bundle', () => {
  strictEqual('createNodeRuntime' in nodeAdapters, false)
  strictEqual('nodeRuntime' in nodeAdapters, false)
  strictEqual(typeof nodeAdapters.createNodeFileSystem, 'function')
  strictEqual(typeof nodeAdapters.createJitiModuleLoader, 'function')
  strictEqual(typeof nodeAdapters.createNodeContextStorage, 'function')
  strictEqual(typeof nodeAdapters.createSharpImageProcessor, 'function')
})

test('node adapter factories return individual adapter objects', () => {
  strictEqual(typeof createNodeFileSystem().read, 'function')
  strictEqual(typeof createJitiModuleLoader().load, 'function')
  strictEqual(typeof createNodeContextStorage().run, 'function')
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
