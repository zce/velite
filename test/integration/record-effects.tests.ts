import { deepEqual, equal, ok, rejects } from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import type { TestContext } from 'node:test'

const distEntry = fileURLToPath(new URL('../../dist/index.mjs', import.meta.url))

const loadPackage = async (): Promise<typeof import('../../src/index')> => {
  ok(existsSync(distEntry), 'dist/index.mjs not found — run `pnpm build` before this suite')
  return import(distEntry)
}

const fixture = async (t: TestContext, schema: string): Promise<string> => {
  const dir = await mkdtemp(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'velite-record-effects-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(join(dir, 'content'))
  await writeFile(
    join(dir, 'velite.config.js'),
    `import { context, defineConfig, s } from 'velite'
export default defineConfig({
  root: 'content',
  output: { name: '[name].[ext]' },
  collections: { posts: { pattern: 'posts.json', schema: ${schema} } }
})
`
  )
  return dir
}

test('packaged build: invalid siblings discard assets and unique registrations without discarding a valid same-source neighbor', async t => {
  const dir = await fixture(t, `s.object({ attachment: s.file(), slug: s.unique('records'), title: s.string() })`)
  await writeFile(
    join(dir, 'content/posts.json'),
    JSON.stringify([
      { attachment: './invalid.txt', slug: 'shared', title: 123 },
      { attachment: './valid.txt', slug: 'shared', title: 'Valid neighbor' }
    ])
  )
  await writeFile(join(dir, 'content/invalid.txt'), 'invalid record asset')
  await writeFile(join(dir, 'content/valid.txt'), 'valid record asset')

  const { build } = await loadPackage()
  const result = await build({ cwd: dir, layout: 'single', logLevel: 'silent' })

  deepEqual(
    result.output.collections.posts!.entries.map(entry => entry.data),
    [{ attachment: '/static/valid.txt', slug: 'shared', title: 'Valid neighbor' }]
  )
  deepEqual(await readdir(join(dir, 'public/static')), ['valid.txt'], 'only the valid record asset is published')
  equal(await readFile(join(dir, 'public/static/valid.txt'), 'utf8'), 'valid record asset')
  equal(result.diagnostics.length, 1, 'the invalid record must not register a duplicate unique value')
  const issue = result.diagnostics[0]!
  equal(issue.code, 'SCHEMA_INVALID')
  deepEqual(issue.provenance, {
    scope: 'record',
    collection: { order: 0, id: 'posts' },
    source: { path: 'posts.json' },
    record: { index: 0, id: 'posts.json#0' },
    path: ['title']
  })
  deepEqual(JSON.parse(await readFile(join(dir, '.velite/posts.json'), 'utf8')), [{ attachment: '/static/valid.txt', slug: 'shared', title: 'Valid neighbor' }])
})

test('packaged build: native catch recovery and optional discarded issues retain effects when the final record is valid', async t => {
  const dir = await fixture(
    t,
    `s.object({
      attachment: s.file(),
      slug: s.unique('records'),
      title: s.string().catch('Recovered'),
      wrapped: s.string().optional().transform(async (_value, ctx) => {
        await s.file().parseAsync('./wrapped.txt')
        context().collectEffect(
          { type: 'unique', group: 'wrapped', value: 'retained' },
          { path: ['wrapped'], declaration: 0, occurrence: { kind: 'singleton' } }
        )
        ctx.addIssue({ code: 'custom', message: 'discarded optional issue' })
        return 'discarded value'
      }).optional()
    })`
  )
  await writeFile(
    join(dir, 'content/posts.json'),
    JSON.stringify([
      { attachment: './recovered.txt', slug: 'one', title: 123 },
      { attachment: './neighbor.txt', slug: 'two', title: 'Valid neighbor' }
    ])
  )
  for (const name of ['recovered', 'neighbor', 'wrapped']) await writeFile(join(dir, `content/${name}.txt`), `${name} asset`)

  const { build } = await loadPackage()
  await writeFile(join(dir, 'content/posts.json'), JSON.stringify([{ attachment: './recovered.txt', slug: 'one', title: 123 }]))
  const recovered = await build({ cwd: dir, layout: 'single', logLevel: 'silent' })
  deepEqual(recovered.diagnostics, [])
  equal((recovered.output.collections.posts!.entries[0]!.data as { title: string }).title, 'Recovered')
  equal((recovered.output.collections.posts!.entries[0]!.data as { wrapped?: string }).wrapped, undefined)
  deepEqual(await readdir(join(dir, 'public/static')), ['recovered.txt', 'wrapped.txt'])
  await writeFile(
    join(dir, 'content/posts.json'),
    JSON.stringify([
      { attachment: './recovered.txt', slug: 'one', title: 123 },
      { attachment: './neighbor.txt', slug: 'two', title: 'Valid neighbor' }
    ])
  )
  const result = await build({ cwd: dir, layout: 'single', logLevel: 'silent' })

  const entries = result.output.collections.posts!.entries
  equal(entries.length, 0)
  deepEqual(JSON.parse(await readFile(join(dir, '.velite/posts.json'), 'utf8')), [])
  deepEqual(await readdir(join(dir, 'public/static')), [])
  equal(result.diagnostics.length, 2, 'both valid records retain the wrapped uniqueness declaration')
  for (const issue of result.diagnostics) {
    equal(issue.code, 'SCHEMA_INVALID')
    equal(issue.message, 'duplicate unique value "retained" in group "wrapped"')
  }
  deepEqual(result.diagnostics.map(issue => (issue.provenance.scope === 'record' ? issue.provenance.record.id : undefined)).sort(), [
    'posts.json#0',
    'posts.json#1'
  ])
})

test('packaged Builder: incremental record invalidation removes assets and declarations while preserving existing cross-record checks', async t => {
  const dir = await fixture(
    t,
    `s.object({
      attachment: s.file(),
      slug: s.string().superRefine(value => context().collectEffect(
        { type: 'unique', group: 'records', value },
        { path: ['slug'], declaration: 0, occurrence: { kind: 'singleton' } }
      )),
      title: s.string()
    })`
  )
  const source = join(dir, 'content/posts.json')
  const neighbor = { attachment: './neighbor.txt', slug: 'neighbor', title: 'Valid neighbor' }
  await writeFile(source, JSON.stringify([{ attachment: './changed.txt', slug: 'first', title: 'Initially valid' }, neighbor]))
  await writeFile(join(dir, 'content/changed.txt'), 'changed record asset')
  await writeFile(join(dir, 'content/neighbor.txt'), 'neighbor asset')

  const { builder, build } = await loadPackage()
  const instance = builder({ cwd: dir, logLevel: 'silent' })
  t.after(() => instance.dispose())
  const initial = await instance.build({ layout: 'single' })
  deepEqual(initial.diagnostics, [])
  deepEqual(await readdir(join(dir, 'public/static')), ['changed.txt', 'neighbor.txt'])

  await writeFile(source, JSON.stringify([{ attachment: './changed.txt', slug: 'neighbor', title: 123 }, neighbor]))
  const incremental = await instance.apply([{ type: 'change', absPath: source }])
  ok(incremental !== undefined)
  deepEqual(
    incremental.output.collections.posts!.entries.map(entry => entry.data),
    [{ attachment: '/static/neighbor.txt', slug: 'neighbor', title: 'Valid neighbor' }]
  )
  equal(incremental.diagnostics.length, 1, 'invalid two-argument unique declarations do not reach cross-record checks')
  deepEqual(await readdir(join(dir, 'public/static')), ['neighbor.txt'], 'the previously published invalid-record asset is removed')
  const full = await build({ cwd: dir, layout: 'single', logLevel: 'silent' })
  deepEqual(incremental.output, full.output)
  deepEqual(incremental.diagnostics, full.diagnostics)

  await writeFile(source, JSON.stringify([{ attachment: './changed.txt', slug: 'neighbor', title: 'Valid again' }, neighbor]))
  const conflict = await instance.apply([{ type: 'change', absPath: source }])
  ok(conflict !== undefined)
  equal(conflict.diagnostics.length, 2, 'valid record promotion does not bypass the existing cross-record uniqueness gate')
  for (const issue of conflict.diagnostics) equal(issue.message, 'duplicate unique value "neighbor" in group "records"')
  deepEqual(await readdir(join(dir, 'public/static')), [])
})

test('packaged build: two-argument asset declarations reach the existing asset gate only when their record is valid', async t => {
  const dir = await fixture(
    t,
    `s.object({
      attachment: s.file(),
      slug: s.string().superRefine(value => context().collectEffect(
        { type: 'unique', group: 'records', value },
        { path: ['slug'], declaration: 0, occurrence: { kind: 'singleton' } }
      )),
      declared: s.string().superRefine(source => {
        if (source === '') return
        const { project, collectEffect } = context()
        collectEffect(
          { type: 'asset', source: project.root + '/' + source, output: { base: project.output.base, template: project.output.name }, metadata: false },
          { path: ['declared'], declaration: 0, occurrence: { kind: 'singleton' } }
        )
      }),
      title: s.string()
    })`
  )
  await writeFile(
    join(dir, 'content/posts.json'),
    JSON.stringify([
      { attachment: './invalid.txt', slug: 'shared', declared: 'missing.txt', title: 123 },
      { attachment: './valid.txt', slug: 'shared', declared: '', title: 'Valid neighbor' }
    ])
  )
  await writeFile(join(dir, 'content/invalid.txt'), 'invalid asset')
  await writeFile(join(dir, 'content/valid.txt'), 'valid asset')

  const { build, VeliteError } = await loadPackage()
  const result = await build({ cwd: dir, layout: 'single', logLevel: 'silent' })

  equal(result.output.collections.posts!.entries.length, 1)
  equal(result.diagnostics.length, 1, 'there is no fatal missing-asset diagnostic and no duplicate unique diagnostic')
  equal(result.diagnostics[0]!.code, 'SCHEMA_INVALID')
  deepEqual(await readdir(join(dir, 'public/static')), ['valid.txt'])
  deepEqual(JSON.parse(await readFile(join(dir, '.velite/posts.json'), 'utf8')), [
    { attachment: '/static/valid.txt', slug: 'shared', declared: '', title: 'Valid neighbor' }
  ])

  await writeFile(
    join(dir, 'content/posts.json'),
    JSON.stringify([
      { attachment: './invalid.txt', slug: 'first', declared: 'missing.txt', title: 'Now valid' },
      { attachment: './valid.txt', slug: 'shared', declared: '', title: 'Valid neighbor' }
    ])
  )
  await rejects(
    build({ cwd: dir, layout: 'single', logLevel: 'silent' }),
    (error: unknown) => error instanceof VeliteError && error.code === 'asset' && error.diagnostics.some(issue => issue.code === 'ASSET_FAILED'),
    'valid two-argument asset declarations still pass through the existing build asset policy'
  )
})
