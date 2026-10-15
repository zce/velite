import { deepEqual, match, ok } from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

import type { TestContext } from 'node:test'
import type { BuildResult } from '../../src/index'

type ContentProject = Awaited<ReturnType<typeof contentProject>>

const config = (single: boolean) => `import {content,defineConfig,s} from 'velite'
const doc=content.markdown()
export default defineConfig({output:{name:'[name].[ext]'},collections:{site:{pattern:'*.json',single:${single},schema:s.object({key:s.unique('records'),html:doc.html()})}}})`

const assets = { 'a.txt': 'asset A\n', 'b.txt': 'asset B\n', 'c.txt': 'asset C\n' }

const conflictingRecords = JSON.stringify([
  { key: 'shared', html: '[A](./a.txt)' },
  { key: 'shared', html: '[B](./b.txt)' },
  { key: 'valid', html: '[C](./c.txt)' }
])

const publishedAssets = async (project: ContentProject) => {
  const dir = join(project.dir, 'public/static')
  const names = await readdir(dir).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  return Promise.all(names.sort().map(async name => ({ name, bytes: await readFile(join(dir, name)) })))
}

const diagnosticSummary = (result: BuildResult) =>
  result.diagnostics.map(issue => ({ code: issue.code, level: issue.level, stage: issue.stage, provenance: issue.provenance }))

const assertConflictingSingleton = async (t: TestContext, project: ContentProject, result: BuildResult) => {
  await t.test('retains the valid record, not either conflicting first candidate', () => {
    deepEqual(result.output.collections.site, {
      collection: 'site',
      mode: 'single',
      entries: [{ id: 'records.json#2', source: 'records.json', data: { key: 'valid', html: '<p><a href="/static/c.txt">C</a></p>' } }]
    })
  })
  await t.test('writes the valid singleton to the actual data file, not null', async () => {
    deepEqual(JSON.parse(await project.read('.velite/site.json')), { key: 'valid', html: '<p><a href="/static/c.txt">C</a></p>' })
  })
  await t.test('diagnoses both conflicting participants with their record provenance', () => {
    const conflicts = result.diagnostics.filter(issue => issue.code === 'SCHEMA_INVALID')
    deepEqual(
      conflicts.map(issue => ({ level: issue.level, stage: issue.stage, provenance: issue.provenance })),
      [
        {
          level: 'error',
          stage: 'schema',
          provenance: {
            scope: 'record',
            collection: { order: 0, id: 'site' },
            source: { path: 'records.json' },
            record: { index: 0, id: 'records.json#0' }
          }
        },
        {
          level: 'error',
          stage: 'schema',
          provenance: {
            scope: 'record',
            collection: { order: 0, id: 'site' },
            source: { path: 'records.json' },
            record: { index: 1, id: 'records.json#1' }
          }
        }
      ]
    )
    for (const issue of conflicts) match(issue.message, /duplicate unique value "shared" in group "records"/)
  })
  await t.test('reports neither multiple nor empty when exactly one candidate remains valid', () => {
    deepEqual(result.diagnostics.map(issue => issue.code).sort(), ['SCHEMA_INVALID', 'SCHEMA_INVALID'])
  })
  await t.test('publishes only the valid record asset with its original bytes', async () => {
    deepEqual(await publishedAssets(project), [{ name: 'c.txt', bytes: Buffer.from('asset C\n') }])
  })
}

const assertRecoveredSingleton = async (t: TestContext, project: ContentProject, result: BuildResult) => {
  await t.test('selects the canonical first entry from three valid candidates', () => {
    deepEqual(result.output.collections.site, {
      collection: 'site',
      mode: 'single',
      entries: [{ id: 'records.json#0', source: 'records.json', data: { key: 'shared', html: '<p><a href="/static/a.txt">A</a></p>' } }]
    })
  })
  await t.test('writes the selected first candidate to the actual data file', async () => {
    deepEqual(JSON.parse(await project.read('.velite/site.json')), { key: 'shared', html: '<p><a href="/static/a.txt">A</a></p>' })
  })
  await t.test('clears both conflicts and reports the existing multiple-candidate warning', () => {
    deepEqual(diagnosticSummary(result), [
      {
        code: 'COLLECTION_MULTIPLE',
        level: 'warn',
        stage: 'schema',
        provenance: { scope: 'collection', collection: { order: 0, id: 'site' } }
      }
    ])
    match(result.diagnostics[0]!.message, /matched 3 entries; using the first/)
  })
  await t.test('preserves managed assets from every valid singleton candidate', async () => {
    deepEqual(await publishedAssets(project), [
      { name: 'a.txt', bytes: Buffer.from('asset A\n') },
      { name: 'b.txt', bytes: Buffer.from('asset B\n') },
      { name: 'c.txt', bytes: Buffer.from('asset C\n') }
    ])
  })
}

test('content single validity: full build retains the valid neighbor of conflicting JSON records', async t => {
  const project = await contentProject(t, config(true), { 'records.json': conflictingRecords, ...assets })
  await assertConflictingSingleton(t, project, await project.build())
})

test('content single validity: excluding every conflicting candidate reports an empty singleton and publishes no assets', async t => {
  const project = await contentProject(t, config(true), {
    'records.json': JSON.stringify([
      { key: 'shared', html: '[A](./a.txt)' },
      { key: 'shared', html: '[B](./b.txt)' }
    ]),
    ...assets
  })
  const result = await project.build()
  await t.test('retains no invalid winner', () => {
    deepEqual(result.output.collections.site, { collection: 'site', mode: 'single', entries: [] })
  })
  await t.test('writes null to the actual data file when no valid candidate remains', async () => {
    deepEqual(JSON.parse(await project.read('.velite/site.json')), null)
  })
  await t.test('reports empty rather than multiple after excluding both conflicting participants', () => {
    deepEqual(result.diagnostics.map(issue => issue.code).sort(), ['COLLECTION_EMPTY', 'SCHEMA_INVALID', 'SCHEMA_INVALID'])
    const empty = result.diagnostics.find(issue => issue.code === 'COLLECTION_EMPTY')!
    deepEqual(
      { level: empty.level, stage: empty.stage, provenance: empty.provenance },
      { level: 'error', stage: 'schema', provenance: { scope: 'collection', collection: { order: 0, id: 'site' } } }
    )
    match(empty.message, /matched no valid entry/)
  })
  await t.test('publishes no asset bytes from either invalid participant', async () => {
    deepEqual(await publishedAssets(project), [])
  })
})

test('content single validity: durable conflict → valid → conflict transitions and a fresh full build have literal valid outputs', async t => {
  const project = await contentProject(t, config(true), { 'records.json': conflictingRecords, ...assets })
  const instance = project.api.builder({ cwd: project.dir, logLevel: 'silent' })
  t.after(() => instance.dispose())

  const first = await instance.build({ layout: 'single' })
  await t.test('initial durable full build', t => assertConflictingSingleton(t, project, first))

  const source = join(project.dir, 'content/records.json')
  await writeFile(
    source,
    JSON.stringify([
      { key: 'shared', html: '[A](./a.txt)' },
      { key: 'distinct', html: '[B](./b.txt)' },
      { key: 'valid', html: '[C](./c.txt)' }
    ])
  )
  const recovered = await instance.apply([{ type: 'change', absPath: source }])
  ok(recovered !== undefined, 'the JSON change must produce an incremental build result')
  await t.test('conflict → valid incremental build', t => assertRecoveredSingleton(t, project, recovered))

  await writeFile(source, conflictingRecords)
  const conflicted = await instance.apply([{ type: 'change', absPath: source }])
  ok(conflicted !== undefined, 'restoring the conflict must produce an incremental build result')
  await t.test('valid → conflict incremental build', t => assertConflictingSingleton(t, project, conflicted))

  const fresh = await project.build()
  await t.test('fresh one-shot full build after incremental conflict', t => assertConflictingSingleton(t, project, fresh))
})

for (const single of [false, true]) {
  const mode = single ? 'single' : 'list'

  test(`content single validity: normal ${mode} collection with zero candidates preserves empty-output diagnostics`, async t => {
    const project = await contentProject(t, config(single), { 'records.json': '[]' })
    const result = await project.build()
    deepEqual(result.output.collections.site, { collection: 'site', mode, entries: [] })
    deepEqual(JSON.parse(await project.read('.velite/site.json')), single ? null : [])
    deepEqual(
      diagnosticSummary(result),
      single
        ? [
            {
              code: 'COLLECTION_EMPTY',
              level: 'error',
              stage: 'schema',
              provenance: { scope: 'collection', collection: { order: 0, id: 'site' } }
            }
          ]
        : []
    )
    if (single) match(result.diagnostics[0]!.message, /matched no valid entry/)
    deepEqual(await publishedAssets(project), [])
  })

  test(`content single validity: normal ${mode} collection with one candidate emits its data and asset without cardinality diagnostics`, async t => {
    const project = await contentProject(t, config(single), { 'records.json': JSON.stringify([{ key: 'only', html: '[C](./c.txt)' }]), ...assets })
    const result = await project.build()
    const data = { key: 'only', html: '<p><a href="/static/c.txt">C</a></p>' }
    deepEqual(result.output.collections.site, { collection: 'site', mode, entries: [{ id: 'records.json#0', source: 'records.json', data }] })
    deepEqual(JSON.parse(await project.read('.velite/site.json')), single ? data : [data])
    deepEqual(result.diagnostics, [])
    deepEqual(await publishedAssets(project), [{ name: 'c.txt', bytes: Buffer.from('asset C\n') }])
  })

  test(`content single validity: normal ${mode} collection with multiple candidates preserves canonical ordering, selection and all valid assets`, async t => {
    const project = await contentProject(t, config(single), {
      'z.json': JSON.stringify([{ key: 'alpha', html: '[C](./c.txt)' }]),
      'a.json': JSON.stringify([
        { key: 'zulu', html: '[A](./a.txt)' },
        { key: 'middle', html: '[B](./b.txt)' }
      ]),
      ...assets
    })
    const result = await project.build()
    const first = { key: 'zulu', html: '<p><a href="/static/a.txt">A</a></p>' }
    const second = { key: 'middle', html: '<p><a href="/static/b.txt">B</a></p>' }
    const last = { key: 'alpha', html: '<p><a href="/static/c.txt">C</a></p>' }
    deepEqual(result.output.collections.site, {
      collection: 'site',
      mode,
      entries: single
        ? [{ id: 'a.json#0', source: 'a.json', data: first }]
        : [
            { id: 'a.json#0', source: 'a.json', data: first },
            { id: 'a.json#1', source: 'a.json', data: second },
            { id: 'z.json#0', source: 'z.json', data: last }
          ]
    })
    deepEqual(JSON.parse(await project.read('.velite/site.json')), single ? first : [first, second, last])
    deepEqual(
      diagnosticSummary(result),
      single
        ? [
            {
              code: 'COLLECTION_MULTIPLE',
              level: 'warn',
              stage: 'schema',
              provenance: { scope: 'collection', collection: { order: 0, id: 'site' } }
            }
          ]
        : []
    )
    if (single) match(result.diagnostics[0]!.message, /matched 3 entries; using the first/)
    deepEqual(await publishedAssets(project), [
      { name: 'a.txt', bytes: Buffer.from('asset A\n') },
      { name: 'b.txt', bytes: Buffer.from('asset B\n') },
      { name: 'c.txt', bytes: Buffer.from('asset C\n') }
    ])
  })
}
