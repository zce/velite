import { deepEqual } from 'node:assert'
import { EventEmitter } from 'node:events'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

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
