// Contract test against the BUILT package entry (dist/index.mjs), not src/.
// Validates that bundling (tsdown), export maps, externalisation, and shebang
// injection produce a usable runtime entry — the src-only `api-contract` test
// cannot catch those.
//
// This test FAILS LOUDLY when `dist/index.mjs` is absent. The `pnpm test`
// script always runs `pnpm build` first, so the release-critical published
// surface cannot pass review silently. The companion `pnpm test:src` script
// excludes this file (and `test/integration/`) from its run, since they need
// dist/ on disk and aren't part of the inner-loop unit suite.
import { equal, ok } from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const distEntry = fileURLToPath(new URL('../dist/index.mjs', import.meta.url))
const repoRoot = fileURLToPath(new URL('..', import.meta.url))

test('dist: package entry is built and exports the public surface', async () => {
  ok(existsSync(distEntry), `dist/index.mjs not found — run \`pnpm build\` before this suite (or use \`pnpm test:src\` for src-only)`)
  const velite = (await import(distEntry)) as Record<string, unknown>
  const values = [
    'build',
    'watch',
    'builder',
    'createBuilder',
    's',
    'defineConfig',
    'defineCollection',
    'defineLoader',
    'defineSchema',
    'context',
    'VeliteError'
  ]
  for (const name of values) {
    ok(typeof velite[name] !== 'undefined', `dist missing value export: ${name}`)
  }
  ok(typeof velite.build === 'function', 'build is a function')
  ok(typeof velite.watch === 'function', 'watch is a function')
  ok(typeof velite.s === 'object' && velite.s !== null, 's is an object')
  ok(typeof (velite.s as Record<string, unknown>).string === 'function', 's.string is a function')
})

test('dist: package.json exports map, module, and types all resolve to existing dist files', () => {
  // What npm and the TypeScript resolver actually read at install time — a
  // regression in any of these fields (or in the corresponding tsdown emit)
  // would ship a package whose direct `import 'velite'` works but whose
  // tooling-resolved entry / types path does not.
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    exports?: Record<string, string | Record<string, string>>
    module?: string
    main?: string
    types?: string
    bin?: string | Record<string, string>
  }

  // `module` and `types` (TS path) must point at real dist files.
  ok(typeof pkg.module === 'string', 'package.json#module is a string')
  ok(existsSync(join(repoRoot, pkg.module!)), `package.json#module target missing: ${pkg.module}`)
  ok(typeof pkg.types === 'string', 'package.json#types is a string')
  ok(existsSync(join(repoRoot, pkg.types!)), `package.json#types target missing: ${pkg.types}`)

  // `exports['.']` must resolve to an existing file (either a string or a
  // conditional record with at least `import` / `default`).
  ok(pkg.exports != null && typeof pkg.exports === 'object', 'package.json#exports is an object')
  const rootEntry = pkg.exports!['.']
  ok(rootEntry !== undefined, 'package.json#exports["."] is defined')
  const resolveCandidate = typeof rootEntry === 'string' ? rootEntry : (rootEntry.import ?? rootEntry.default ?? rootEntry.node)
  ok(typeof resolveCandidate === 'string', `package.json#exports["."] does not resolve to a path: ${JSON.stringify(rootEntry)}`)
  ok(existsSync(join(repoRoot, resolveCandidate!)), `package.json#exports["."] target missing: ${resolveCandidate}`)

  // `exports["./package.json"]` is conventional — npm tooling expects to read
  // the package.json through the export map when one is declared.
  ok(pkg.exports!['./package.json'] !== undefined, 'package.json#exports["./package.json"] is declared')

  // `module` must match the export map's `.` entry so both consumers and
  // bundlers land on the same file.
  equal(pkg.module, resolveCandidate, '`module` and `exports["."]` must point at the same dist file')
})

test('dist: TypeScript resolves `velite` types through the export map', async () => {
  // A tsc --noEmit consumer fixture catches regressions where the runtime
  // import works but TS cannot resolve the types (e.g. missing .d.mts under
  // exports conditions, or types field pointing at a non-existent file).
  const tscBin = join(repoRoot, 'node_modules', '.bin', 'tsc')
  ok(existsSync(tscBin), 'tsc binary not found — run pnpm install first')

  const fixtureDir = join(repoRoot, 'test', 'fixtures', 'ts-consumer')
  ok(existsSync(join(fixtureDir, 'consumer.ts')), 'ts-consumer fixture missing')

  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(resolve => {
    const child = spawn(tscBin, ['--noEmit', '--project', join(fixtureDir, 'tsconfig.json')], {
      cwd: repoRoot,
      stdio: 'pipe'
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => (stdout += String(chunk)))
    child.stderr.on('data', chunk => (stderr += String(chunk)))
    child.on('close', code => resolve({ code, stdout, stderr }))
  })

  equal(result.code, 0, `tsc --noEmit failed (TS cannot resolve velite types):\nstdout: ${result.stdout}\nstderr: ${result.stderr}`)
})
