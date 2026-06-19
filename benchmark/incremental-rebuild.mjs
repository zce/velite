// Incremental rebuild benchmark
//
// This benchmark is intentionally relative and local. It is NOT a CI assertion
// and produces no pass/fail status; numbers vary across machines, file systems,
// and Node versions. Use it to compare the cost of a full rebuild against the
// incremental paths (content rebuild, linked-asset owner rebuild) on a single
// machine while iterating on the Engine.
//
// Watch mode is currently the public long-lived caller of the Engine. The
// performance target is the Engine's incremental behavior itself; running
// scenarios through `watch()` exercises the same code paths that
// production users hit.
//
// Reading the output:
//   - "full build"          baseline cold build via build()
//   - "watch start"         time to first stable build through watch()
//   - "content rebuild"     time from mutating one document to .velite/c0.json
//                           reflecting the new value
//   - "asset-owner rebuild" time from mutating shared.txt to c0.json reflecting
//                           the new fingerprinted public URL (only the owners
//                           of the asset should rebuild)
//
// Tuning:
//   VELITE_BENCH_DOCS         documents per collection (default 1000)
//   VELITE_BENCH_COLLECTIONS  number of collections     (default 4)
//   VELITE_BENCH_KEEP=1       keep the temp fixture on disk for inspection

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

const DOCS = Number(process.env.VELITE_BENCH_DOCS ?? 1000)
const COLLECTIONS = Number(process.env.VELITE_BENCH_COLLECTIONS ?? 4)
const KEEP = process.env.VELITE_BENCH_KEEP === '1'

const waitFor = async (predicate, { interval = 20, timeout = 10_000, label = 'condition' } = {}) => {
  const start = performance.now()
  let timer
  try {
    while (true) {
      try {
        if (await predicate()) return
      } catch {
        // swallow transient errors (e.g. file not yet written)
      }
      if (performance.now() - start > timeout) {
        throw new Error(`waitFor timed out after ${timeout}ms: ${label}`)
      }
      await new Promise(resolve => {
        timer = setTimeout(resolve, interval)
      })
      timer = undefined
    }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

const generateConfig = collections => {
  const collectionEntries = Array.from({ length: collections }, (_, i) => {
    const name = `c${i}`
    const typeName = `C${i}`
    return [
      `    ${name}: {`,
      `      name: '${typeName}',`,
      `      pattern: '${name}/*.json',`,
      `      schema: s.object({ title: s.string(), file: s.file().optional() })`,
      `    }`
    ].join('\n')
  }).join(',\n')

  return [
    "import { defineConfig, s } from 'velite'",
    '',
    'export default defineConfig({',
    "  root: 'content',",
    "  output: { data: '.velite', assets: 'public/static', clean: true, name: '[name]-[hash:8].[ext]' },",
    '  collections: {',
    collectionEntries,
    '  }',
    '})',
    ''
  ].join('\n')
}

const generateFixture = async root => {
  const contentDir = join(root, 'content')
  await mkdir(contentDir, { recursive: true })
  await writeFile(join(contentDir, 'shared.txt'), 'shared-v1')

  for (let c = 0; c < COLLECTIONS; c++) {
    const dir = join(contentDir, `c${c}`)
    await mkdir(dir, { recursive: true })
    for (let d = 0; d < DOCS; d++) {
      const doc = { title: `c${c}-doc-${d}` }
      if (d % 10 === 0) doc.file = '../shared.txt'
      await writeFile(join(dir, `doc-${d}.json`), JSON.stringify(doc))
    }
  }

  await writeFile(join(root, 'velite.config.mjs'), generateConfig(COLLECTIONS))
}

const main = async () => {
  const { build, watch } = await import('../dist/index.js')

  const root = await mkdtemp(join(tmpdir(), 'velite-bench-'))
  const configPath = join(root, 'velite.config.mjs')
  const c0Json = join(root, '.velite', 'c0.json')
  const firstDoc = join(root, 'content', 'c0', 'doc-0.json')
  const sharedTxt = join(root, 'content', 'shared.txt')

  const results = []
  let watcher

  try {
    await generateFixture(root)

    // 1) full build
    {
      const t0 = performance.now()
      await build({ config: configPath, logLevel: 'silent' })
      const ms = performance.now() - t0
      results.push({ label: 'full build', ms: Number(ms.toFixed(2)) })
    }

    // 2) watch start (first build through the watcher)
    {
      const t0 = performance.now()
      watcher = await watch({ config: configPath, logLevel: 'silent' })
      await waitFor(
        async () => {
          const text = await readFile(c0Json, 'utf8')
          return text.includes('c0-doc-0')
        },
        { label: 'watch start: c0.json initial content' }
      )
      const ms = performance.now() - t0
      results.push({ label: 'watch start', ms: Number(ms.toFixed(2)) })
    }

    // Allow chokidar to finish wiring its watchers before we mutate files.
    // `watch()` returns once the initial build resolves, but chokidar has
    // `ignoreInitial: true` and needs a moment to attach its handlers; without
    // this settle delay the first mutation can land before chokidar is ready.
    await new Promise(resolve => setTimeout(resolve, 250))

    // 3) content rebuild: mutate a single document, wait for c0.json to reflect it
    {
      const marker = `bench-content-${Date.now()}`
      const t0 = performance.now()
      await writeFile(firstDoc, JSON.stringify({ title: marker }))
      await waitFor(
        async () => {
          const text = await readFile(c0Json, 'utf8')
          return text.includes(marker)
        },
        { label: 'content rebuild: c0.json reflects new title' }
      )
      const ms = performance.now() - t0
      results.push({ label: 'content rebuild', ms: Number(ms.toFixed(2)) })
    }

    // 4) asset-owner rebuild: mutate shared.txt; only owner collections should rebuild.
    //    The fingerprinted public URL changes (new hash), so wait until the URL in
    //    c0.json differs from the snapshot taken before the mutation.
    {
      const before = await readFile(c0Json, 'utf8')
      const t0 = performance.now()
      await writeFile(sharedTxt, `shared-v2-${Date.now()}`)
      await waitFor(
        async () => {
          const text = await readFile(c0Json, 'utf8')
          return text.includes('shared') && text !== before
        },
        { label: 'asset-owner rebuild: c0.json reflects new shared URL' }
      )
      const ms = performance.now() - t0
      results.push({ label: 'asset-owner rebuild', ms: Number(ms.toFixed(2)) })
    }

    console.log(`fixture: ${COLLECTIONS} collections x ${DOCS} docs (${COLLECTIONS * DOCS} files) at ${root}`)
    console.table(results)
  } finally {
    if (watcher) {
      try {
        await watcher.close()
      } catch {
        // ignore close errors during teardown
      }
    }
    if (!KEEP) {
      await rm(root, { recursive: true, force: true })
    } else {
      console.log(`VELITE_BENCH_KEEP=1: fixture left at ${root}`)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
