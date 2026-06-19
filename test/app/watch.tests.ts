import { equal, ok } from 'node:assert'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
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

const waitForFileIncludes = async (path: string, expected: string): Promise<boolean> => {
  for (let i = 0; i < 50; i++) {
    await sleep(100)
    try {
      const text = await readFile(path, 'utf8')
      if (text.includes(expected)) return true
    } catch {
      continue
    }
  }
  return false
}

const waitForEntry = async (dir: string, expected: string): Promise<boolean> => {
  for (let i = 0; i < 80; i++) {
    await sleep(150)
    try {
      const entries = await readdir(dir)
      if (entries.includes(expected)) return true
    } catch {
      continue
    }
  }
  return false
}

test('watch rebuilds when content changes', async () => {
  const { watch } = await import('velite')
  const root = await mkdtemp(join(tmpdir(), 'velite-watch-content-'))
  let watcher: Awaited<ReturnType<typeof watch>> | undefined

  await mkdir(join(root, 'content'))
  await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'Initial' }))
  await writeFile(join(root, 'velite.config.mjs'), fixtureConfig('a'))

  try {
    watcher = await watch({ config: join(root, 'velite.config.mjs'), logLevel: 'silent' })

    const dataPath = join(root, '.velite-a', 'items.json')
    // Initial build is synchronous here; allow watcher to settle.
    await sleep(150)

    await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'Changed' }))

    const updated = await waitForFileIncludes(dataPath, 'Changed')
    ok(updated, 'expected items.json to reflect the changed content within timeout')

    await watcher.close()
    watcher = undefined

    await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'After close' }))
    await sleep(300)
    const afterClose = await readFile(dataPath, 'utf8')
    ok(!afterClose.includes('After close'), 'expected watcher.close() to stop future rebuilds')
  } finally {
    await watcher?.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('watch reloads config when config dependency changes', async () => {
  const { watch } = await import('velite')
  const root = await mkdtemp(join(tmpdir(), 'velite-watch-config-'))
  let watcher: Awaited<ReturnType<typeof watch>> | undefined

  await mkdir(join(root, 'content'))
  await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'Hello' }))
  await writeFile(join(root, 'velite.config.mjs'), fixtureConfig('a'))

  try {
    watcher = await watch({ config: join(root, 'velite.config.mjs'), logLevel: 'silent' })

    // First build wrote .velite-a; allow watcher to settle.
    await sleep(150)

    // Modify the config to switch the data directory.
    await writeFile(join(root, 'velite.config.mjs'), fixtureConfig('b'))

    const reloaded = await waitForEntry(root, '.velite-b')
    equal(reloaded, true, 'expected watcher to rebuild into .velite-b after config change')
  } finally {
    await watcher?.close()
    await rm(root, { recursive: true, force: true })
  }
})

test('watch reloads config when an imported config dependency changes', async () => {
  const { watch } = await import('velite')
  const root = await mkdtemp(join(tmpdir(), 'velite-watch-import-'))
  let watcher: Awaited<ReturnType<typeof watch>> | undefined

  const config = [
    "import { defineConfig, s } from 'velite'",
    "import { dataDir } from './settings.mjs'",
    '',
    'export default defineConfig({',
    "  root: 'content',",
    "  output: { data: dataDir, assets: 'public/static', clean: false, name: '[name].[ext]' },",
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

  try {
    await mkdir(join(root, 'content'))
    await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'Hello' }))
    await writeFile(join(root, 'settings.mjs'), "export const dataDir = '.velite-a'\n")
    await writeFile(join(root, 'velite.config.mjs'), config)

    watcher = await watch({ config: join(root, 'velite.config.mjs'), logLevel: 'silent' })
    await sleep(150)

    await writeFile(join(root, 'settings.mjs'), "export const dataDir = '.velite-b'\n")

    const reloaded = await waitForEntry(root, '.velite-b')

    equal(reloaded, true, 'expected watcher to rebuild after imported config dependency change')
  } finally {
    await watcher?.close()
    await rm(root, { recursive: true, force: true })
  }
})
