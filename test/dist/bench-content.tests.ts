import { deepEqual, equal, ok } from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { test } from 'node:test'
import { promisify } from 'node:util'

const exec = promisify(execFile)

test('bench-content measures packaged source-only records without running transforms or compilers', async () => {
  const { stdout } = await exec(process.execPath, ['--import', 'jiti/register', 'scripts/bench-content.ts', '--docs', '2', '--json'])
  const result = JSON.parse(stdout)
  for (const [dialect, short, wordCount] of [
    ['markdown', 'Guide Introductory…', 82],
    ['mdx', 'Page Introductory…', 85]
  ] as const) {
    const item = result.cases.find((item: { dialect: string; demand: string }) => item.dialect === dialect && item.demand === 'source-only')
    ok(item, `${dialect} source-only case is present`)
    const full = item.measurements[0]
    equal(full.name, 'full build')
    equal(full.records, 2)
    deepEqual(full.stages, {
      initializations: 2,
      parses: 2,
      remarkTransforms: 0,
      rehypeTransforms: 0,
      recmaTransforms: 0,
      compilers: 0,
      validations: 2
    })
    equal(full.values.short, short)
    deepEqual(full.values.metadata, { readingTime: 1, wordCount })
    ok(full.values.excerpt.includes('Troubleshooting Inspect diagnostics'))
    equal(full.values.primary, undefined)
    equal(full.values.toc, undefined)
  }
})

test('bench-content measures both dialects and resumes combined late selections without replay', async () => {
  const { stdout } = await exec(process.execPath, ['--import', 'jiti/register', 'scripts/bench-content.ts', '--docs', '2', '--json'])
  const result = JSON.parse(stdout)
  deepEqual(
    result.cases.map((item: { dialect: string; demand: string }) => `${item.dialect}/${item.demand}`),
    [
      'markdown/source-only',
      'markdown/toc-only',
      'markdown/primary-only',
      'markdown/combined',
      'mdx/source-only',
      'mdx/toc-only',
      'mdx/primary-only',
      'mdx/combined'
    ]
  )
  for (const item of result.cases) {
    const full = item.measurements[0]
    const transformed = item.demand !== 'source-only'
    const emitted = item.demand === 'primary-only' || item.demand === 'combined'
    deepEqual(full.stages, {
      initializations: 2,
      parses: 2,
      remarkTransforms: transformed ? 2 : 0,
      rehypeTransforms: transformed ? 2 : 0,
      recmaTransforms: transformed && item.dialect === 'mdx' ? 2 : 0,
      compilers: emitted ? 2 : 0,
      validations: 2
    })
    const title = item.dialect === 'markdown' ? 'Guide' : 'Page'
    if (item.demand === 'toc-only' || item.demand === 'combined') {
      deepEqual(full.values.toc, [
        { depth: 1, title: `Build-time ${title}`, id: `${title}:Target:1` },
        { depth: 2, title: 'Installation', id: 'installation' },
        { depth: 2, title: 'Configuration', id: 'configuration' },
        { depth: 2, title: 'Troubleshooting', id: 'troubleshooting' }
      ])
    } else equal(full.values.toc, undefined)
    if (emitted) {
      ok(full.values.primary.includes(`${title}:Target:1`))
      ok(full.values.primary.includes(`Build-time ${title}`))
      ok(full.values.primary.includes('troubleshooting'))
    } else equal(full.values.primary, undefined)
    if (item.demand === 'combined') {
      equal(full.values.short, `${title} Introductory…`)
      deepEqual(full.values.metadata, { readingTime: 1, wordCount: item.dialect === 'markdown' ? 82 : 85 })
      ok(full.values.excerpt.startsWith(`${title} Introductory documentation`))
      ok(!full.values.excerpt.includes('Build-time'))
    }
    if (item.demand === 'primary-only' || item.demand === 'toc-only') equal(full.values.excerpt, undefined)
  }
})

test('bench-content distinguishes outer memoization from fresh validation and samples repeated durable builds and disposal', async () => {
  const { stdout } = await exec(process.execPath, [
    '--expose-gc',
    '--import',
    'jiti/register',
    'scripts/bench-content.ts',
    '--docs',
    '2',
    '--repeats',
    '2',
    '--json'
  ])
  const result = JSON.parse(stdout)
  equal(result.workload.docsPerCase, 2)
  equal(result.workload.repeatedRevalidations, 2)
  equal(result.workload.assets, 0)
  equal(result.workload.mdx.minify, true)
  equal(result.environment.node, process.version)
  equal(result.environment.gcRequested, true)
  for (const name of ['velite', 'zod', 'unified', '@mdx-js/mdx', 'terser', 'jiti']) ok(result.environment.dependencies[name])
  ok(result.command.some((part: string) => part.endsWith('scripts/bench-content.ts')))
  for (const item of result.cases) {
    deepEqual(
      item.measurements.map((point: { name: string }) => point.name),
      ['full build', 'no-op rebuild', 'single-file incremental rebuild', 'configuration reload', 'revalidate all 1', 'revalidate all 2']
    )
    const noOp = item.measurements[1]
    deepEqual(noOp.stages, { initializations: 0, parses: 0, remarkTransforms: 0, rehypeTransforms: 0, recmaTransforms: 0, compilers: 0, validations: 0 })
    equal(noOp.epoch, 1)
    for (const [point, attempts] of [
      [item.measurements[2], 1],
      [item.measurements[3], 2],
      [item.measurements[4], 2],
      [item.measurements[5], 2]
    ] as const) {
      const transformed = item.demand !== 'source-only'
      const emitted = item.demand === 'primary-only' || item.demand === 'combined'
      deepEqual(point.stages, {
        initializations: attempts,
        parses: attempts,
        remarkTransforms: transformed ? attempts : 0,
        rehypeTransforms: transformed ? attempts : 0,
        recmaTransforms: transformed && item.dialect === 'mdx' ? attempts : 0,
        compilers: emitted ? attempts : 0,
        validations: attempts
      })
      equal(point.epoch, point === item.measurements[2] ? 1 : 2)
    }
    const reloaded = item.measurements[3].values
    const title = item.dialect === 'markdown' ? 'Guide' : 'Page'
    if (reloaded.toc) equal(reloaded.toc[0].id, `${title}:Target:2`)
    if (reloaded.primary) ok(reloaded.primary.includes(`${title}:Target:2`))
    if (reloaded.metadata) deepEqual(reloaded.metadata, { readingTime: 1, wordCount: item.dialect === 'markdown' ? 82 : 85 })
    for (const sample of [item.before, item.disposal.memory, ...item.measurements.map((point: { memory: unknown }) => point.memory)]) {
      for (const key of ['rssMb', 'heapUsedMb', 'externalMb', 'arrayBuffersMb']) ok(Number.isFinite(sample[key]))
    }
    for (const point of [...item.measurements, item.disposal]) ok(Number.isFinite(point.ms) && point.ms >= 0)
  }
})
