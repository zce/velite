// Integration test: build the examples/basic fixture against the PACKAGED
// entry (dist/index.mjs). Exercises the full stack the unit suite cannot:
// config self-reference (jiti alias `velite` → dist), real sharp image
// probing on real content, the two-pass asset flow, output writing, and the
// generated `index.d.ts`.
//
// Each test copies the fixture into an isolated temp directory so concurrent
// integration suites (e.g. cli.tests.ts) cannot race on the same output.
//
// FAILS LOUDLY when `dist/index.mjs` is absent. Run `pnpm test` (which builds
// first). The companion `pnpm test:src` script excludes `test/integration/`
// so the inner-loop unit suite stays runnable without rebuilding dist.
import { ok } from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = join(here, '..', '..')
const distEntry = join(repoRoot, 'dist', 'index.mjs')
const fixtureSource = join(repoRoot, 'examples', 'basic')

test('examples/basic: builds against the packaged entry and emits data + assets', async t => {
  ok(existsSync(distEntry), `dist/index.mjs not found — run \`pnpm build\` before this suite`)

  // Isolate: copy fixture to a temp dir so this test never races with cli.tests.ts.
  const tmpDir = mkdtempSync(join(tmpdir(), 'velite-basic-'))
  cpSync(fixtureSource, tmpDir, { recursive: true })
  // The fixture's `timestamp()` schema runs `exec('git log ...')` which
  // inherits process.env. Set GIT_DIR + GIT_WORK_TREE so git finds the
  // temp repo regardless of the process cwd.
  const prevGitDir = process.env.GIT_DIR
  const prevGitWorkTree = process.env.GIT_WORK_TREE
  process.env.GIT_DIR = join(tmpDir, '.git')
  process.env.GIT_WORK_TREE = tmpDir
  execSync('git init -q && git add -A && git commit -q -m init', { cwd: tmpDir, stdio: 'ignore' })
  t.after(() => {
    if (prevGitDir === undefined) delete process.env.GIT_DIR
    else process.env.GIT_DIR = prevGitDir
    if (prevGitWorkTree === undefined) delete process.env.GIT_WORK_TREE
    else process.env.GIT_WORK_TREE = prevGitWorkTree
    rmSync(tmpDir, { recursive: true, force: true })
  })

  const dataDir = join(tmpDir, '.velite')
  const assetsDir = join(tmpDir, 'public', 'static')

  const { build } = (await import(distEntry)) as {
    build: (o: { cwd: string; clean?: boolean; layout?: 'split' | 'single' }) => Promise<{ written: string[]; diagnostics: unknown[] }>
  }
  const result = await build({ cwd: tmpDir, clean: true, layout: 'single' })

  ok(result.diagnostics.length === 0, `unexpected diagnostics: ${JSON.stringify(result.diagnostics)}`)
  ok(result.written.length > 0, 'build wrote output files')

  const postsPath = join(dataDir, 'posts.json')
  ok(existsSync(postsPath), 'posts.json written')
  const posts = JSON.parse(readFileSync(postsPath, 'utf8')) as Array<Record<string, unknown>>
  ok(posts.length > 0, 'posts array is non-empty')
  ok(
    posts.every(p => typeof p.slug === 'string' && typeof p.permalink === 'string'),
    'every post has a slug + permalink'
  )

  ok(
    result.written.some(p => p.startsWith(assetsDir)),
    'assets written into public/static'
  )

  // Generated declaration file: the writer emits .velite/index.d.ts so the
  // consuming app gets typed access to its collections. examples/basic
  // declares `Post`, `Category`, `Tag`, `Page`, `Options` typeNames and a
  // matching set of exports. Assert the declaration carries each one — a
  // regression in declaration generation would otherwise pass silently.
  const dtsPath = join(dataDir, 'index.d.ts')
  ok(existsSync(dtsPath), 'index.d.ts written')
  const dts = readFileSync(dtsPath, 'utf8')
  for (const typeName of ['Post', 'Category', 'Tag', 'Page', 'Options']) {
    ok(new RegExp(`\\b${typeName}\\b`).test(dts), `index.d.ts references ${typeName}`)
  }
  for (const exportName of ['posts', 'categories', 'tags', 'pages', 'options']) {
    ok(new RegExp(`export\\s+declare\\s+const\\s+${exportName}\\b`).test(dts), `index.d.ts exports declare const ${exportName}`)
  }
})
