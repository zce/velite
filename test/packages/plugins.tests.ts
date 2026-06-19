import { deepEqual, equal, ok } from 'node:assert'
import { EventEmitter } from 'node:events'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'))

test('framework plugin packages are publish-ready and version-aligned', async () => {
  const [root, next, vite] = await Promise.all([readJson('package.json'), readJson('packages/next/package.json'), readJson('packages/vite/package.json')])

  for (const pkg of [next, vite]) {
    equal(pkg.version, root.version)
    equal(pkg.peerDependencies.velite, undefined)
    equal(pkg.dependencies.velite, 'workspace:*')
    deepEqual(pkg.engines, root.engines)
    deepEqual(pkg.exports, { '.': { types: './index.d.ts', default: './index.js' } })
    ok(pkg.files.includes('index.js'))
    ok(pkg.files.includes('index.d.ts'))
    equal(pkg.publishConfig.access, 'public')
  }
})

test('content discovery uses tinyglobby instead of fast-glob', async () => {
  const pkg = await readJson('package.json')

  equal(pkg.devDependencies['fast-glob'], undefined)
  ok(pkg.devDependencies.tinyglobby)
})

test('publish workflow sends prereleases to the next npm tag', async () => {
  const workflow = await readFile('.github/workflows/publish.yml', 'utf8')

  ok(workflow.includes('NPM_TAG=next'))
  ok(workflow.includes('NPM_TAG=latest'))
  ok(workflow.includes('--tag "$NPM_TAG"'))
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
