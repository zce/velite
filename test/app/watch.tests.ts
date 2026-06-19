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

const cleanConfig = (includeRemoved: boolean) =>
  [
    "import { defineConfig, s } from 'velite'",
    '',
    'export default defineConfig({',
    "  root: 'content',",
    "  output: { data: '.velite', assets: 'public/static', clean: true, name: '[name].[ext]' },",
    '  collections: {',
    "    items: { name: 'Item', pattern: 'item.json', schema: s.object({ title: s.string() }) }" + (includeRemoved ? ',' : ''),
    includeRemoved ? "    removed: { name: 'Removed', pattern: 'removed.json', schema: s.object({ title: s.string() }) }" : '',
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

test('watch config reload honors output.clean from user config', async () => {
  const { watch } = await import('velite')
  const root = await mkdtemp(join(tmpdir(), 'velite-watch-clean-'))
  let watcher: Awaited<ReturnType<typeof watch>> | undefined

  await mkdir(join(root, 'content'))
  await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'Hello' }))
  await writeFile(join(root, 'content', 'removed.json'), JSON.stringify({ title: 'Stale' }))
  await writeFile(join(root, 'velite.config.mjs'), cleanConfig(true))

  try {
    watcher = await watch({ config: join(root, 'velite.config.mjs'), logLevel: 'silent' })
    await sleep(150)
    ok(await waitForEntry(join(root, '.velite'), 'removed.json'), 'initial build should emit removed.json')

    await writeFile(join(root, 'velite.config.mjs'), cleanConfig(false))

    for (let i = 0; i < 50; i++) {
      await sleep(100)
      const entries = await readdir(join(root, '.velite'))
      if (!entries.includes('removed.json')) return
    }
    equal(false, true, 'config reload should clean stale collection output')
  } finally {
    await watcher?.close()
    await rm(root, { recursive: true, force: true })
  }
})

const assetOwnerConfig = (countsLog: string) =>
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
    "      pattern: 'item-*.json',",
    '      schema: s.object({ title: s.string(), file: s.file() })',
    '    }',
    '  }',
    '})',
    ''
  ].join('\n')

const readCountsLog = async (path: string): Promise<string[]> => {
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

const countsEndsWith = (entries: string[], suffix: string): number => entries.filter(entry => entry.endsWith(suffix)).length

test('watch rebuilds only owner content when a linked asset changes', async () => {
  const { watch } = await import('velite')
  const root = await mkdtemp(join(tmpdir(), 'velite-watch-asset-'))
  let watcher: Awaited<ReturnType<typeof watch>> | undefined

  await mkdir(join(root, 'content'))
  await writeFile(join(root, 'content', 'item-a.json'), JSON.stringify({ title: 'A', file: './shared.txt' }))
  await writeFile(join(root, 'content', 'item-b.json'), JSON.stringify({ title: 'B', file: './other.txt' }))
  await writeFile(join(root, 'content', 'shared.txt'), 'shared-v1')
  await writeFile(join(root, 'content', 'other.txt'), 'other-v1')
  const countsPath = join(root, 'counts.log')
  await writeFile(countsPath, '')
  await writeFile(join(root, 'velite.config.mjs'), assetOwnerConfig(countsPath))

  try {
    watcher = await watch({ config: join(root, 'velite.config.mjs'), logLevel: 'silent' })

    let initial: string[] = []
    for (let i = 0; i < 80; i++) {
      await sleep(100)
      initial = await readCountsLog(countsPath)
      if (countsEndsWith(initial, 'item-a.json') >= 1 && countsEndsWith(initial, 'item-b.json') >= 1) break
    }
    equal(countsEndsWith(initial, 'item-a.json'), 1, 'initial build should load item-a.json once')
    equal(countsEndsWith(initial, 'item-b.json'), 1, 'initial build should load item-b.json once')

    await writeFile(join(root, 'content', 'shared.txt'), 'shared-v2')

    let afterChange: string[] = initial
    let owners = 0
    for (let i = 0; i < 50; i++) {
      await sleep(100)
      afterChange = await readCountsLog(countsPath)
      owners = countsEndsWith(afterChange, 'item-a.json') - countsEndsWith(initial, 'item-a.json')
      if (owners >= 1) break
    }
    equal(owners, 1, 'asset change should reload item-a.json exactly once')
    equal(countsEndsWith(afterChange, 'item-b.json') - countsEndsWith(initial, 'item-b.json'), 0, 'asset change should not reload item-b.json')
  } finally {
    await watcher?.close()
    await rm(root, { recursive: true, force: true })
  }
})
