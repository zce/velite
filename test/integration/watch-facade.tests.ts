// Facade-level smoke test: drive the public `watch()` export from
// `src/index.ts` against a real temp project. This catches future regressions
// in the entry layer that the Builder-level test in test/watch-initial-build
// cannot — e.g. re-introducing an extra `instance.build()` before
// `instance.watch()` would double-call the user's `prepare` hook on startup.
//
// Needs the built dist (`pnpm build`) because the node adapter's module loader
// jiti-aliases `'velite'` to dist for the user config's self-imports. Excluded
// from `test:src` along with the rest of test/integration/.
import { equal, ok } from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

test('public watch() facade: initial build runs exactly once and handle.initial is populated', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'velite-watch-facade-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  mkdirSync(join(dir, 'content', 'posts'), { recursive: true })
  writeFileSync(join(dir, 'content', 'posts', 'a.json'), JSON.stringify([{ title: 'A' }]))
  const counterPath = join(dir, 'prepare-calls.txt')
  // velite.config.js — bumps a counter on disk every time prepare runs. The
  // counter survives outside the worker so we can read it after watch()
  // resolves regardless of how the handle was awaited.
  writeFileSync(
    join(dir, 'velite.config.js'),
    `import { defineConfig, s } from 'velite'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
const COUNTER = ${JSON.stringify(counterPath)}
export default defineConfig({
  root: 'content',
  collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } },
  prepare: () => {
    const prev = existsSync(COUNTER) ? Number(readFileSync(COUNTER, 'utf8')) : 0
    writeFileSync(COUNTER, String(prev + 1))
  }
})
`
  )

  const { watch } = (await import('../../src/index')) as typeof import('../../src/index')
  const handle = await watch({ cwd: dir, logLevel: 'silent' })
  try {
    const count = Number(readFileSync(counterPath, 'utf8'))
    equal(count, 1, `public watch() ran prepare ${count} times on startup; expected exactly 1`)
    ok(handle.initial !== undefined, 'facade watch() returned a handle with .initial')
    ok(handle.initial.written.length > 0, 'initial build wrote output')
    equal(handle.initial.diagnostics.length, 0)
  } finally {
    await handle.close()
  }
})
