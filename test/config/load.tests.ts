import { ok, rejects, strictEqual } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { describe, it } from 'node:test'

import { createConfigLoader } from '../../src/config/load'

describe('ConfigLoader', () => {
  it('throws when no config file is found', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-config-empty-'))
    try {
      const loader = createConfigLoader()
      await rejects(loader.load(join(root, 'no-such-config.ts')), /not supported config file with 'ts' extension|config file not found/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('throws on unsupported config file extension', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-config-bad-'))
    try {
      const path = join(root, 'velite.config.json')
      await writeFile(path, '{}')
      const loader = createConfigLoader()
      await rejects(loader.load(path), /not supported config file with 'json' extension/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('loads a minimal config and returns absolute output paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-config-load-'))
    try {
      await mkdir(join(root, 'content'))
      await writeFile(
        join(root, 'velite.config.mjs'),
        [
          "import { defineConfig, s } from 'velite'",
          'export default defineConfig({',
          "  collections: { items: { name: 'Item', pattern: 'item.json', schema: s.object({ title: s.string() }) } }",
          '})'
        ].join('\n')
      )

      const loader = createConfigLoader()
      const config = await loader.load(join(root, 'velite.config.mjs'))

      ok(isAbsolute(config.root), 'root should be absolute')
      ok(isAbsolute(config.output.data), 'output.data should be absolute')
      ok(isAbsolute(config.output.assets), 'output.assets should be absolute')
      strictEqual(config.output.format, 'esm')
      strictEqual(config.strict, false)
      strictEqual(config.output.clean, false)
      ok(config.loaders.length >= 1, 'built-in loaders should be merged in')
      ok(config.collections.items != null)
      // configImports should always be absolute paths.
      ok(
        config.configImports.every(p => isAbsolute(p)),
        'configImports should be absolute'
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('overrides clean and strict via load options', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-config-overrides-'))
    try {
      await mkdir(join(root, 'content'))
      await writeFile(
        join(root, 'velite.config.mjs'),
        [
          "import { defineConfig, s } from 'velite'",
          'export default defineConfig({',
          "  output: { data: '.velite', assets: 'public/static', clean: false },",
          "  collections: { items: { name: 'Item', pattern: 'item.json', schema: s.object({ title: s.string() }) } }",
          '})'
        ].join('\n')
      )

      const loader = createConfigLoader()
      const config = await loader.load(join(root, 'velite.config.mjs'), { clean: true, strict: true })

      strictEqual(config.output.clean, true)
      strictEqual(config.strict, true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not write into the user node_modules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-config-no-nm-'))
    try {
      await mkdir(join(root, 'node_modules'))
      await mkdir(join(root, 'content'))
      await writeFile(
        join(root, 'velite.config.mjs'),
        [
          "import { defineConfig, s } from 'velite'",
          'export default defineConfig({',
          "  collections: { items: { name: 'Item', pattern: 'item.json', schema: s.object({ title: s.string() }) } }",
          '})'
        ].join('\n')
      )

      const loader = createConfigLoader()
      await loader.load(join(root, 'velite.config.mjs'))

      const { readdir } = await import('node:fs/promises')
      const entries = await readdir(join(root, 'node_modules'))
      ok(
        entries.every(name => !name.startsWith('.velite.config')),
        'config compilation must not leave bundled artefacts in user node_modules'
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reuses the same loader across multiple loads without leaking temp bundles', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-config-reuse-'))
    try {
      await mkdir(join(root, 'content'))
      await writeFile(
        join(root, 'velite.config.mjs'),
        [
          "import { defineConfig, s } from 'velite'",
          'export default defineConfig({',
          "  collections: { items: { name: 'Item', pattern: 'item.json', schema: s.object({ title: s.string() }) } }",
          '})'
        ].join('\n')
      )

      const loader = createConfigLoader()
      const first = await loader.load(join(root, 'velite.config.mjs'))
      const second = await loader.load(join(root, 'velite.config.mjs'))

      // Both loads should resolve the same configPath and the same set of imports.
      strictEqual(first.configPath, second.configPath)
      strictEqual(first.configImports.length, second.configImports.length)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reloads changed config contents with the same loader instance', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-config-reload-'))
    const configPath = join(root, 'velite.config.mjs')
    const source = (dataDir: string) =>
      [
        "import { defineConfig, s } from 'velite'",
        'export default defineConfig({',
        `  output: { data: '${dataDir}' },`,
        "  collections: { items: { name: 'Item', pattern: 'item.json', schema: s.object({ title: s.string() }) } }",
        '})'
      ].join('\n')

    try {
      await mkdir(join(root, 'content'))
      await writeFile(configPath, source('.velite-a'))

      const loader = createConfigLoader()
      const first = await loader.load(configPath)

      await writeFile(configPath, source('.velite-b'))
      const second = await loader.load(configPath)

      strictEqual(first.output.data, join(root, '.velite-a'))
      strictEqual(second.output.data, join(root, '.velite-b'))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects collection names that cannot be emitted as TypeScript identifiers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-config-invalid-name-'))
    try {
      await mkdir(join(root, 'content'))
      await writeFile(
        join(root, 'velite.config.mjs'),
        [
          "import { defineConfig, s } from 'velite'",
          'export default defineConfig({',
          "  collections: { posts: { name: 'Blog Post', pattern: 'item.json', schema: s.object({ title: s.string() }) } }",
          '})'
        ].join('\n')
      )

      const loader = createConfigLoader()
      await rejects(loader.load(join(root, 'velite.config.mjs')), /collection 'posts' name 'Blog Post' must be a valid TypeScript identifier/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
