import { deepEqual } from 'node:assert'
import { EventEmitter } from 'node:events'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

test('plugin packages declare the repository used for npm provenance', async () => {
  const expected = 'https://github.com/zce/velite'

  for (const path of ['packages/next/package.json', 'packages/vite/package.json']) {
    const pkg = JSON.parse(await readFile(path, 'utf8'))
    deepEqual(pkg.repository, { type: 'git', url: expected })
  }
})

test('plugin declarations import the public BuildOptions type', async () => {
  for (const path of ['packages/next/index.d.ts', 'packages/vite/index.d.ts', 'packages/next/index.js', 'packages/vite/index.js']) {
    const content = await readFile(path, 'utf8')
    deepEqual(content.includes("import('velite').Options"), false)
    deepEqual(content.includes('import type { Options as VeliteOptions }'), false)
  }
})

test('vite plugin starts a closeable velite watcher in dev server mode', async () => {
  const root = await mkdtemp(join(tmpdir(), 'velite-plugin-vite-'))

  try {
    await mkdir(join(root, 'node_modules', 'velite'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'velite', 'package.json'), JSON.stringify({ type: 'module' }))
    await writeFile(
      join(root, 'node_modules', 'velite', 'index.js'),
      [
        'globalThis.__veliteCalls = globalThis.__veliteCalls ?? []',
        'export const build = async options => globalThis.__veliteCalls.push(["build", options])',
        'export const watch = async options => {',
        '  globalThis.__veliteCalls.push(["watch", options])',
        '  return { close: async () => globalThis.__veliteCalls.push(["close"]) }',
        '}'
      ].join('\n')
    )
    await cp('packages/vite/index.js', join(root, 'index.js'))

    globalThis.__veliteCalls = []
    const { default: velite } = await import(`${join(root, 'index.js')}?${Date.now()}`)
    const plugin = velite({ config: 'velite.config.ts', logLevel: 'silent' })
    const httpServer = new EventEmitter()

    await plugin.configureServer({ httpServer })
    deepEqual(globalThis.__veliteCalls, [['watch', { config: 'velite.config.ts', logLevel: 'silent' }]])

    httpServer.emit('close')
    await new Promise(resolve => setImmediate(resolve))
    deepEqual(globalThis.__veliteCalls, [['watch', { config: 'velite.config.ts', logLevel: 'silent' }], ['close']])
  } finally {
    delete globalThis.__veliteCalls
    await rm(root, { recursive: true, force: true })
  }
})

declare global {
  var __veliteCalls: unknown[] | undefined
}
