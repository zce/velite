import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import type { Logger, LogLevel } from '../../src/runtime/logger'

const silentLogger: Logger = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  clear: () => {},
  set: (_level: LogLevel) => {}
}

const fixtureConfig = (countsLog: string) =>
  [
    "import { defineConfig, defineLoader, s } from 'velite'",
    "import { appendFile } from 'node:fs/promises'",
    '',
    `const countsLog = ${JSON.stringify(countsLog)}`,
    '',
    'const countingJsonLoader = defineLoader({',
    '  test: /\\.json$/,',
    '  load: async file => {',
    "    await appendFile(countsLog, file.path + '\\n')",
    '    return { data: JSON.parse(file.toString()) }',
    '  }',
    '})',
    '',
    'export default defineConfig({',
    "  root: 'content',",
    "  output: { data: '.velite', assets: 'public/static', clean: false, name: '[name].[ext]' },",
    '  loaders: [countingJsonLoader],',
    '  collections: {',
    '    items: {',
    "      name: 'Item',",
    "      pattern: '*.json',",
    '      schema: s.object({ title: s.string() })',
    '    }',
    '  }',
    '})',
    ''
  ].join('\n')

const readCounts = async (path: string): Promise<string[]> => {
  try {
    const text = await readFile(path, 'utf8')
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
  } catch {
    return []
  }
}

const countMatches = (entries: string[], suffix: string): number => entries.filter(entry => entry.endsWith(suffix)).length

describe('engine incremental rebuild', () => {
  it('reuses cached files for unchanged paths and reloads only changed paths', async () => {
    const { createEngine } = await import('../../src/app/engine')
    const root = await mkdtemp(join(tmpdir(), 'velite-engine-incremental-'))

    try {
      const contentDir = join(root, 'content')
      await mkdir(contentDir, { recursive: true })

      const aPath = join(contentDir, 'a.json')
      const bPath = join(contentDir, 'b.json')
      await writeFile(aPath, JSON.stringify({ title: 'A1' }))
      await writeFile(bPath, JSON.stringify({ title: 'B1' }))

      const countsLog = join(root, 'counts.log')
      await writeFile(countsLog, '')

      await writeFile(join(root, 'velite.config.mjs'), fixtureConfig(countsLog))

      const engine = createEngine({ logger: silentLogger })

      await engine.build({ config: join(root, 'velite.config.mjs'), logLevel: 'silent' })

      const initial = await readCounts(countsLog)
      strictEqual(countMatches(initial, 'a.json'), 1, 'initial build should load a.json once')
      strictEqual(countMatches(initial, 'b.json'), 1, 'initial build should load b.json once')

      // Targeted rebuild for a.json only.
      await writeFile(aPath, JSON.stringify({ title: 'A2' }))
      await engine.rebuild({ event: 'change', paths: [aPath] })

      const afterChange = await readCounts(countsLog)
      strictEqual(countMatches(afterChange, 'a.json') - countMatches(initial, 'a.json'), 1, 'targeted rebuild should reload only a.json once')
      strictEqual(countMatches(afterChange, 'b.json') - countMatches(initial, 'b.json'), 0, 'targeted rebuild should not reload b.json')

      // Full rebuild without change clears incremental state and reloads both.
      await engine.rebuild()

      const afterFull = await readCounts(countsLog)
      strictEqual(countMatches(afterFull, 'a.json') - countMatches(afterChange, 'a.json'), 1, 'full rebuild should reload a.json once')
      strictEqual(countMatches(afterFull, 'b.json') - countMatches(afterChange, 'b.json'), 1, 'full rebuild should reload b.json once')

      deepStrictEqual(
        {
          a: countMatches(afterFull, 'a.json'),
          b: countMatches(afterFull, 'b.json')
        },
        { a: 3, b: 2 }
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('clears stale unique values for changed files before incremental rebuilds', async () => {
    const { createEngine } = await import('../../src/app/engine')
    const { loaders } = await import('../../src/loaders')
    const { s } = await import('../../src/schemas')
    const root = await mkdtemp(join(tmpdir(), 'velite-engine-unique-incremental-'))

    try {
      const contentDir = join(root, 'content')
      await mkdir(contentDir, { recursive: true })

      const aPath = join(contentDir, 'a.json')
      const bPath = join(contentDir, 'b.json')
      await writeFile(aPath, JSON.stringify({ slug: 'hello' }))
      await writeFile(bPath, JSON.stringify({ slug: 'world' }))

      const configPath = join(root, 'velite.config.mjs')
      const engine = createEngine({
        logger: silentLogger,
        loader: {
          async load() {
            return {
              configPath,
              configImports: [],
              root: contentDir,
              strict: true,
              output: { data: join(root, '.velite'), assets: join(root, 'public/static'), clean: false, format: 'esm', name: '[name].[ext]', base: '/static/' },
              loaders,
              collections: {
                posts: {
                  name: 'Post',
                  pattern: '*.json',
                  schema: s.object({ slug: s.string().and(s.unique('slug')) })
                }
              }
            }
          }
        }
      })

      await engine.build({ logLevel: 'silent' })

      await writeFile(aPath, JSON.stringify({ slug: 'hello-v2' }))
      await engine.rebuild({ event: 'change', paths: [aPath] })

      await writeFile(bPath, JSON.stringify({ slug: 'hello' }))
      const result = await engine.rebuild({ event: 'change', paths: [bPath] })

      deepStrictEqual(result.posts.map(post => post.slug).sort(), ['hello', 'hello-v2'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
