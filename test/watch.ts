import { equal, ok } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'

const fixtureConfig = (assetsDir: string) =>
  [
    "import { defineConfig, s } from 'velite'",
    '',
    'export default defineConfig({',
    "  root: 'content',",
    `  output: { data: '.velite-${assetsDir}', assets: 'public/${assetsDir}', clean: false, name: '[name].[ext]' },`,
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

test('watch rebuilds when content changes', async () => {
  const { build } = await import('velite')
  const root = await mkdtemp(join(tmpdir(), 'velite-watch-content-'))

  await mkdir(join(root, 'content'))
  await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'Initial' }))
  await writeFile(join(root, 'velite.config.mjs'), fixtureConfig('a'))

  try {
    await build({ config: join(root, 'velite.config.mjs'), watch: true, logLevel: 'silent' })

    const dataPath = join(root, '.velite-a', 'items.json')
    // Initial build is synchronous here; allow watcher to settle.
    await sleep(150)

    await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'Changed' }))

    // Poll for the rebuild result up to 5s.
    let updated = false
    for (let i = 0; i < 50; i++) {
      await sleep(100)
      const { readFile } = await import('node:fs/promises')
      try {
        const text = await readFile(dataPath, 'utf8')
        if (text.includes('Changed')) {
          updated = true
          break
        }
      } catch {
        continue
      }
    }
    ok(updated, 'expected items.json to reflect the changed content within timeout')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('watch reloads config when config dependency changes', async () => {
  const { build } = await import('velite')
  const root = await mkdtemp(join(tmpdir(), 'velite-watch-config-'))

  await mkdir(join(root, 'content'))
  await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'Hello' }))
  await writeFile(join(root, 'velite.config.mjs'), fixtureConfig('a'))

  try {
    await build({ config: join(root, 'velite.config.mjs'), watch: true, logLevel: 'silent' })

    // First build wrote .velite-a; allow watcher to settle.
    await sleep(150)

    // Modify the config to switch the data directory.
    await writeFile(join(root, 'velite.config.mjs'), fixtureConfig('b'))

    let reloaded = false
    for (let i = 0; i < 80; i++) {
      await sleep(150)
      const { readdir } = await import('node:fs/promises')
      try {
        const entries = await readdir(root)
        if (entries.includes('.velite-b')) {
          reloaded = true
          break
        }
      } catch {
        continue
      }
    }
    equal(reloaded, true, 'expected watcher to rebuild into .velite-b after config change')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
