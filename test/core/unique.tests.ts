// Integration tests for the cross-file uniqueness check (uniqueCheck derivation).
// Uses the full builder + MemoryFileSystem so the two-stage aggregation
// (validate collects UniqueEffect → uniqueCheck detects conflicts → emit merges
// diagnostics) is exercised end-to-end, including the incremental path.
import { equal, ok } from 'node:assert/strict'
import { test } from 'node:test'

import { createBuilder, s } from '../../src/core'
import { join } from '../../src/core/util/path'
import { silentLogger } from '../../src/runtime/adapters/node/logger'
import { MemoryFileSystem } from '../helpers/memory-fs'

import type { UserConfig } from '../../src/core/config'
import type { Runtime } from '../../src/runtime'

const CWD = '/proj'

const config: UserConfig = {
  root: 'content',
  collections: {
    posts: { pattern: 'posts/*.md', schema: s.object({ title: s.string(), slug: s.slug() }) }
  }
}

const setup = (files: Record<string, string>): { runtime: Runtime; fs: MemoryFileSystem } => {
  const fs = new MemoryFileSystem()
  for (const [path, content] of Object.entries(files)) fs.put(path, content)
  const runtime: Runtime = { fs, modules: { load: async () => ({ exports: config, dependencies: [] }) }, logger: silentLogger }
  return { runtime, fs }
}

const build = (runtime: Runtime) => createBuilder(runtime, { cwd: CWD, configPath: join(CWD, 'velite.config.ts') }).build()

const post = (slug: string, title = slug): string => `---\ntitle: ${title}\nslug: ${slug}\n---\nbody`

const abs = (rel: string): string => join(CWD, rel)

test('uniqueCheck: flags a duplicate slug across two records', async () => {
  const { runtime } = setup({
    [abs('content/posts/a.md')]: post('hello-world', 'A'),
    [abs('content/posts/b.md')]: post('hello-world', 'B')
  })
  const result = await build(runtime)
  const dupes = result.diagnostics.filter(d => d.code === 'SCHEMA_INVALID' && d.message.includes('duplicate unique value'))
  equal(dupes.length, 2, 'one diagnostic per conflicting owner')
  ok(dupes.every(d => d.stage === 'schema'))
  ok(dupes.every(d => d.recordId !== undefined))
  // both owners are flagged
  const owners = new Set(dupes.map(d => d.recordId))
  ok(owners.has('posts/a.md#hello-world') || owners.has('posts/a.md#'), `owners: ${[...owners].join(',')}`)
  // entries are still emitted (non-fatal schema diagnostics)
  equal(result.output.collections.posts!.entries.length, 2)
})

test('uniqueCheck: no conflict when slugs differ', async () => {
  const { runtime } = setup({
    [abs('content/posts/a.md')]: post('hello-world'),
    [abs('content/posts/b.md')]: post('other-slug')
  })
  const result = await build(runtime)
  const dupes = result.diagnostics.filter(d => d.message.includes('duplicate unique value'))
  equal(dupes.length, 0)
  equal(result.diagnostics.length, 0)
  equal(result.output.collections.posts!.entries.length, 2)
})

test('uniqueCheck: distinct groups do not conflict', async () => {
  // Two collections, each with its own slug group → no cross-collection conflict.
  const cfg: UserConfig = {
    root: 'content',
    collections: {
      posts: { pattern: 'posts/*.md', schema: s.object({ title: s.string(), slug: s.slug('posts') }) },
      notes: { pattern: 'notes/*.md', schema: s.object({ title: s.string(), slug: s.slug('notes') }) }
    }
  }
  const fs = new MemoryFileSystem()
  fs.put(abs('content/posts/a.md'), post('shared-slug', 'A'))
  fs.put(abs('content/notes/b.md'), post('shared-slug', 'B'))
  const runtime: Runtime = { fs, modules: { load: async () => ({ exports: cfg, dependencies: [] }) }, logger: silentLogger }
  const result = await build(runtime)
  const dupes = result.diagnostics.filter(d => d.message.includes('duplicate unique value'))
  equal(dupes.length, 0, 'same value in different groups is not a conflict')
})

test('uniqueCheck: incremental — changing one record clears the conflict', async () => {
  const { runtime, fs } = setup({
    [abs('content/posts/a.md')]: post('hello-world', 'A'),
    [abs('content/posts/b.md')]: post('hello-world', 'B')
  })
  const builder = createBuilder(runtime, { cwd: CWD, configPath: join(CWD, 'velite.config.ts') })

  const first = await builder.build()
  const firstDupes = first.diagnostics.filter(d => d.message.includes('duplicate unique value'))
  equal(firstDupes.length, 2, 'initial build flags both owners')

  // Edit post b to use a different slug.
  fs.put(abs('content/posts/b.md'), post('goodbye-world', 'B'))
  const second = await builder.applyChanges([{ type: 'change', absPath: abs('content/posts/b.md') }])
  ok(second !== undefined, 'applyChanges returns a rebuild result for content changes')
  const secondDupes = second.diagnostics.filter(d => d.message.includes('duplicate unique value'))
  equal(secondDupes.length, 0, 'conflict clears after one slug changes')

  builder.dispose()
})

test('uniqueCheck: incremental — backdating (re-setting equal content) keeps the memo', async () => {
  const { runtime } = setup({
    [abs('content/posts/a.md')]: post('hello-world', 'A'),
    [abs('content/posts/b.md')]: post('hello-world', 'B')
  })
  const builder = createBuilder(runtime, { cwd: CWD, configPath: join(CWD, 'velite.config.ts') })
  const first = await builder.build()
  const firstDupes = first.diagnostics.filter(d => d.message.includes('duplicate unique value'))
  equal(firstDupes.length, 2)

  // Re-feed the SAME bytes for post a → engine.set no-ops (equal hash), no recompute.
  // The conflict must still be reported (state unchanged).
  const second = await builder.applyChanges([{ type: 'change', absPath: abs('content/posts/a.md') }])
  ok(second !== undefined)
  const secondDupes = second.diagnostics.filter(d => d.message.includes('duplicate unique value'))
  equal(secondDupes.length, 2, 'backdating equal content preserves the diagnostic state')

  builder.dispose()
})
