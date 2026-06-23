// CLI smoke test: spawn `dist/cli.mjs build` against examples/basic and
// validate the package bin path. Catches regressions the JS-API integration
// test cannot: shebang injection, the bin entry, argument parsing, exit codes.
//
// Each test copies the fixture into an isolated temp directory so concurrent
// integration suites (e.g. basic.tests.ts) cannot race on the same output.
//
// The first test spawns the file directly (kernel shebang execution) on the
// platform, which exercises the `#!/usr/bin/env node` line. The second test
// passes through `process.execPath` for broader OS compatibility (Windows).
// Additionally we assert the first line of `dist/cli.mjs` is the expected
// shebang, covering the tsdown injection step.
//
// Fails loudly when `dist/cli.mjs` is absent — `pnpm test` builds first.
import { equal, match, ok } from 'node:assert/strict'
import { execSync, spawn } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = join(here, '..', '..')
const distCli = join(repoRoot, 'dist', 'cli.mjs')
const fixtureSource = join(repoRoot, 'examples', 'basic')

interface Run {
  code: number | null
  stdout: string
  stderr: string
}

/** Spawn dist/cli.mjs directly (kernel shebang execution) with NODE_ENV=production. */
const spawnDirect = (args: string[], cwd: string): Promise<Run> =>
  new Promise(resolve => {
    const child = spawn(distCli, args, { cwd, env: { ...process.env, NODE_ENV: 'production' }, stdio: 'pipe' })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => (stdout += String(chunk)))
    child.stderr.on('data', chunk => (stderr += String(chunk)))
    child.on('close', code => resolve({ code, stdout, stderr }))
  })

/** Spawn via `node dist/cli.mjs` for broader OS compatibility. */
const spawnViaNode = (args: string[], cwd: string): Promise<Run> =>
  new Promise(resolve => {
    const child = spawn(process.execPath, [distCli, ...args], { cwd, env: { ...process.env, NODE_ENV: 'production' }, stdio: 'pipe' })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => (stdout += String(chunk)))
    child.stderr.on('data', chunk => (stderr += String(chunk)))
    child.on('close', code => resolve({ code, stdout, stderr }))
  })

test('cli: dist/cli.mjs has the expected node shebang on the first line', () => {
  ok(existsSync(distCli), `dist/cli.mjs not found — run \`pnpm build\` before this suite`)
  const firstLine = readFileSync(distCli, 'utf8').split('\n', 1)[0]
  // tsdown injects exactly this shebang on the bin entry; check it stays.
  match(firstLine ?? '', /^#!\/usr\/bin\/env node\b/)
})

test('cli: package.json#bin.velite points at dist/cli.mjs and the target exists', () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { bin?: Record<string, string> | string }
  // npm allows either `{ "bin": "path" }` or `{ "bin": { "velite": "path" } }`.
  // We support both shapes for forward compatibility; the resolved target must
  // exist and must be `dist/cli.mjs` relative to the package root.
  const binValue = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.velite
  equal(binValue, './dist/cli.mjs', `package.json#bin.velite must point at ./dist/cli.mjs, got ${binValue}`)
  ok(existsSync(join(repoRoot, binValue!)), `bin target does not exist: ${binValue}`)
})

test('cli: `velite build` against examples/basic exits 0 and emits data + assets', async t => {
  ok(existsSync(distCli), `dist/cli.mjs not found — run \`pnpm build\` before this suite`)

  // Isolate: copy fixture to a temp dir so this test never races with basic.tests.ts.
  const tmpDir = mkdtempSync(join(tmpdir(), 'velite-cli-'))
  cpSync(fixtureSource, tmpDir, { recursive: true })
  // The fixture's `timestamp()` schema runs `git log` on each file — init a
  // throwaway repo so that command succeeds outside the real worktree.
  // GIT_CEILING_DIRECTORIES prevents git from walking up to the real repo;
  // set it in process.env so the spawned CLI child inherits it.
  const prevCeiling = process.env.GIT_CEILING_DIRECTORIES
  process.env.GIT_CEILING_DIRECTORIES = tmpDir
  execSync('git init -q && git add -A && git commit -q -m init', { cwd: tmpDir, stdio: 'ignore' })
  t.after(() => {
    if (prevCeiling === undefined) delete process.env.GIT_CEILING_DIRECTORIES
    else process.env.GIT_CEILING_DIRECTORIES = prevCeiling
    rmSync(tmpDir, { recursive: true, force: true })
  })

  const dataDir = join(tmpDir, '.velite')
  const assetsDir = join(tmpDir, 'public', 'static')

  // Direct exec on POSIX exercises shebang + the chmod +x tsdown granted.
  // Falls back to `node dist/cli.mjs` on Windows (no shebang support).
  const run = process.platform === 'win32' ? spawnViaNode : spawnDirect
  const result = await run(['build', '--clean'], tmpDir)
  equal(result.code, 0, `cli exited non-zero: ${result.stderr || result.stdout}`)
  ok(existsSync(join(dataDir, 'posts.json')), 'posts.json was written by the cli')
  const posts = JSON.parse(readFileSync(join(dataDir, 'posts.json'), 'utf8')) as Array<{ slug?: string }>
  ok(posts.length > 0 && posts.every(p => typeof p.slug === 'string'), 'posts payload looks valid')
  ok(existsSync(assetsDir), 'assets dir was created by the cli')
})

test('cli: --version prints name/version and exits 0', async () => {
  ok(existsSync(distCli), `dist/cli.mjs not found — run \`pnpm build\` before this suite`)
  const result = await spawnViaNode(['--version'], repoRoot)
  equal(result.code, 0)
  ok(/^velite\//.test(result.stdout.trim()), `unexpected version output: ${result.stdout}`)
})
