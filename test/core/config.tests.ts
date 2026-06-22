import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ConfigError, defineConfig, resolveConfig, validateConfig } from '../../src/core/config'
import { s } from '../../src/core/schema/s'
import { posix } from '../../src/core/util/path'
import { MemoryFileSystem } from '../helpers/memory-fs'

import type { ConfigRuntime, UserConfig } from '../../src/core/config'

// --- validateConfig (pure shape check) --------------------------------------

test('validateConfig: non-object config yields a CONFIG_INVALID diagnostic', () => {
  const diags = validateConfig('nope')
  assert.equal(diags.length, 1)
  assert.equal(diags[0]!.code, 'CONFIG_INVALID')
  assert.equal(diags[0]!.level, 'error')
})

test('validateConfig: missing collections object yields a CONFIG_INVALID diagnostic', () => {
  const diags = validateConfig({ root: '.' })
  assert.equal(diags.length, 1)
  assert.equal(diags[0]!.code, 'CONFIG_INVALID')
  assert.ok(diags[0]!.message.includes('collections'))
})

test('validateConfig: collection missing pattern yields a diagnostic', () => {
  const diags = validateConfig({ collections: { posts: { schema: s.string() } } })
  const codes = diags.map(d => d.code)
  assert.ok(codes.includes('CONFIG_INVALID'))
  assert.ok(diags.some(d => d.collection === 'posts' && d.message.includes('pattern')))
})

test('validateConfig: collection missing schema yields a diagnostic', () => {
  const diags = validateConfig({ collections: { posts: { pattern: '*.md' } } })
  assert.ok(diags.some(d => d.collection === 'posts' && d.message.includes('schema')))
})

test('validateConfig: valid config yields no diagnostics', () => {
  const diags = validateConfig({ collections: { posts: { pattern: '*.md', schema: s.string() } } })
  assert.deepEqual(diags, [])
})

// --- resolveConfig (load → validate → normalize facade) ---------------------

const baseConfig = defineConfig({ collections: { posts: { pattern: '*.md', schema: s.string() } } })

const makeRuntime = (fs: MemoryFileSystem, exports: unknown): ConfigRuntime => ({
  fs,
  path: posix,
  modules: { load: async () => ({ exports, dependencies: [] }) }
})

const setupAt = (configPath: string, exports: unknown): { runtime: ConfigRuntime; fs: MemoryFileSystem } => {
  const fs = new MemoryFileSystem()
  fs.put(configPath, '// stub — module loader returns the exports directly')
  return { runtime: makeRuntime(fs, exports), fs }
}

test('resolveConfig: uses an explicit configPath and exposes it on the result', async () => {
  const configPath = '/proj/velite.config.ts'
  const { runtime } = setupAt(configPath, { default: baseConfig })
  const resolved = await resolveConfig(runtime, { cwd: '/proj', configPath })
  assert.equal(resolved.configPath, configPath)
  assert.equal(resolved.root, '/proj')
  assert.equal(resolved.collections.length, 1)
})

test('resolveConfig: accepts a namespace without a `default` export', async () => {
  const { runtime } = setupAt('/proj/velite.config.ts', baseConfig)
  const resolved = await resolveConfig(runtime, { cwd: '/proj', configPath: '/proj/velite.config.ts' })
  assert.equal(resolved.collections.length, 1)
})

test('resolveConfig: searches default candidates at cwd when no configPath is given', async () => {
  const { runtime } = setupAt('/proj/velite.config.ts', { default: baseConfig })
  const resolved = await resolveConfig(runtime, { cwd: '/proj' })
  assert.equal(resolved.configPath, '/proj/velite.config.ts')
})

test('resolveConfig: walks up parent directories up to searchDepth', async () => {
  // cwd is two levels below the config; default depth (3) covers it.
  const { runtime } = setupAt('/work/velite.config.ts', { default: baseConfig })
  const resolved = await resolveConfig(runtime, { cwd: '/work/apps/web' })
  assert.equal(resolved.configPath, '/work/velite.config.ts')
})

test('resolveConfig: throws when the config file cannot be located', async () => {
  const fs = new MemoryFileSystem()
  const runtime = makeRuntime(fs, { default: baseConfig })
  await assert.rejects(resolveConfig(runtime, { cwd: '/proj' }), /config file not found/)
})

test('resolveConfig: throws ConfigError with diagnostics on validation failure', async () => {
  const { runtime } = setupAt('/proj/velite.config.ts', { default: { collections: { posts: { schema: s.string() } } } })
  await assert.rejects(
    resolveConfig(runtime, { cwd: '/proj', configPath: '/proj/velite.config.ts' }),
    (err: unknown) => err instanceof ConfigError && err.diagnostics.some(d => d.code === 'CONFIG_INVALID')
  )
})

// Normalization — checked through the facade now that the pure helper is gone.

const resolveWith = async (cfg: UserConfig, cwd = '/proj'): Promise<Awaited<ReturnType<typeof resolveConfig>>> => {
  const configPath = posix.join(cwd, 'velite.config.ts')
  const { runtime } = setupAt(configPath, { default: cfg })
  return resolveConfig(runtime, { cwd, configPath })
}

test('resolveConfig: applies defaults: root=".", data=".velite"', async () => {
  const resolved = await resolveWith(defineConfig({ collections: { posts: { pattern: 'posts/*.md', schema: s.object({ title: s.string() }) } } }))
  assert.equal(resolved.root, '/proj')
  assert.equal(resolved.output.data, '/proj/.velite')
})

test('resolveConfig: resolves root and output to absolute paths', async () => {
  const resolved = await resolveWith(
    defineConfig({ root: 'content', output: { data: 'dist/data' }, collections: { posts: { pattern: '*.md', schema: s.string() } } })
  )
  assert.equal(resolved.root, '/proj/content')
  assert.equal(resolved.output.data, '/proj/dist/data')
})

test('resolveConfig: normalizes collection pattern/exclude/single/schema', async () => {
  const cfg = defineConfig({
    collections: {
      posts: { pattern: ['posts/*.md', 'posts/**/*.md'], exclude: 'drafts/**', single: true, schema: s.string() }
    }
  })
  const resolved = await resolveWith(cfg)
  assert.equal(resolved.collections.length, 1)
  const c = resolved.collections[0]!
  assert.equal(c.name, 'posts')
  assert.deepEqual(c.include, ['posts/*.md', 'posts/**/*.md'])
  assert.deepEqual(c.exclude, ['drafts/**'])
  assert.equal(c.single, true)
  assert.strictEqual(c.schema, cfg.collections.posts!.schema)
})

test('resolveConfig: defaults typeName to the collection key and format to esm', async () => {
  const resolved = await resolveWith(defineConfig({ collections: { posts: { pattern: '*.md', schema: s.string() } } }))
  assert.equal(resolved.collections[0]!.typeName, 'posts')
  assert.equal(resolved.output.format, 'esm')
})

test('resolveConfig: honors an explicit typeName and format', async () => {
  const resolved = await resolveWith(
    defineConfig({
      output: { format: 'cjs' },
      collections: { posts: { pattern: '*.md', typeName: 'Post', schema: s.string() } }
    })
  )
  assert.equal(resolved.collections[0]!.typeName, 'Post')
  assert.equal(resolved.output.format, 'cjs')
})

test('resolveConfig: defaults single to false and exclude to empty', async () => {
  const resolved = await resolveWith(defineConfig({ collections: { a: { pattern: 'a/*.json', schema: s.unknown() } } }), '/')
  assert.equal(resolved.collections[0]!.single, false)
  assert.deepEqual(resolved.collections[0]!.exclude, [])
})
