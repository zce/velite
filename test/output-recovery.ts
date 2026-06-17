import { equal, ok } from 'node:assert'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const fixtureConfig = [
  "import { defineConfig, s } from 'velite'",
  '',
  'export default defineConfig({',
  "  root: 'content',",
  "  output: { data: '.velite', assets: 'public/static', clean: false, name: '[name].[ext]' },",
  '  collections: {',
  '    items: {',
  "      name: 'Item',",
  "      pattern: 'item.json',",
  '      schema: s.object({ title: s.string() })',
  '    }',
  '  }',
  '})',
  ''
].join('\n')

test('build twice with the data output directory deleted in between produces all JSON files', async () => {
  const { build } = await import('velite')
  const root = await mkdtemp(join(tmpdir(), 'velite-emit-recover-'))

  await mkdir(join(root, 'content'))
  await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'Hello' }))
  await writeFile(join(root, 'velite.config.mjs'), fixtureConfig)

  try {
    const dataDir = join(root, '.velite')

    await build({ config: join(root, 'velite.config.mjs'), logLevel: 'silent' })
    const before = await readFile(join(dataDir, 'items.json'), 'utf8')
    ok(before.includes('Hello'))

    // Simulate the user deleting the output directory between independent builds.
    await rm(dataDir, { recursive: true, force: true })

    await build({ config: join(root, 'velite.config.mjs'), logLevel: 'silent' })
    const after = await readFile(join(dataDir, 'items.json'), 'utf8')
    ok(after.includes('Hello'), 'second build must regenerate items.json after the data dir was deleted')

    const indexJs = await readFile(join(dataDir, 'index.js'), 'utf8')
    ok(indexJs.length > 0, 'second build must regenerate index.js')

    const indexDts = await readFile(join(dataDir, 'index.d.ts'), 'utf8')
    ok(indexDts.length > 0, 'second build must regenerate index.d.ts')

    equal(typeof before, typeof after)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
