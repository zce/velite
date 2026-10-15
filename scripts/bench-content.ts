import { deepEqual, equal, ok } from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { cpus, release, tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { setImmediate } from 'node:timers/promises'

import type { Builder, BuildResult, Metadata, TocItem } from '../dist/index.mjs'

interface Options {
  docs: number
  repeats: number
  json: boolean
}

interface Stages {
  initializations: number
  parses: number
  remarkTransforms: number
  rehypeTransforms: number
  recmaTransforms: number
  compilers: number
  validations: number
}

type Dialect = 'markdown' | 'mdx'
type Demand = 'source-only' | 'toc-only' | 'primary-only' | 'combined'

interface Values {
  short?: string
  excerpt?: string
  metadata?: Metadata
  toc?: TocItem[]
  primary?: string
}

interface Measurement {
  name: string
  ms: number
  epoch: number
  records: number
  stages: Stages
  endMemory: ReturnType<typeof memory>
  memory: ReturnType<typeof memory>
  values?: Values
}

const DEFAULT_DOCS = 100
const DEFAULT_REPEATS = 3
const prose = `Introductory documentation for a practical content project. This guide explains installation, configuration, and troubleshooting with concise examples.

## Installation

Install the package, define a collection, and run the build command. Keep source analysis separate from transformed navigation.

## Configuration

Use explicit definitions to combine generated content, a navigation table, an excerpt, and reading metadata. Repeat the same selected text across records.

## Troubleshooting

Inspect diagnostics, verify heading targets, and rebuild a changed document. Reusing validated records can skip content plugins on an unchanged build.
`

// Literal source oracle, independent of the production extraction algorithm.
const expectedProse =
  'Introductory documentation for a practical content project. This guide explains installation, configuration, and troubleshooting with concise examples. Installation Install the package, define a collection, and run the build command. Keep source analysis separate from transformed navigation. Configuration Use explicit definitions to combine generated content, a navigation table, an excerpt, and reading metadata. Repeat the same selected text across records. Troubleshooting Inspect diagnostics, verify heading targets, and rebuild a changed document. Reusing validated records can skip content plugins on an unchanged build.'

const body = (dialect: Dialect): string =>
  dialect === 'markdown'
    ? `# Guide\n\n${prose}`
    : `export const Note = ({ children }) => <aside>{children}</aside>\n\n# Page\n\n${prose}\n<Note label="excluded">Static interactive note.</Note>\n`

const document = (dialect: Dialect, index: number, revision: number): string => `---\nname: record-${index}\nrevision: ${revision}\n---\n${body(dialect)}`

const config = (dialect: Dialect, demand: Demand, epoch: number): string => `import { content, defineConfig, s } from 'velite'
const counts = { initializations: 0, parses: 0, remarkTransforms: 0, rehypeTransforms: 0, recmaTransforms: 0, compilers: 0, validations: 0 }
function remark() {
  counts.initializations++
  const parse = this.parser
  this.parser = (text, file) => { counts.parses++; return parse(text, file) }
  return () => { counts.remarkTransforms++ }
}
function wrapCompiler(processor) {
  const compile = processor.compiler
  processor.compiler = (tree, file) => { counts.compilers++; return compile(tree, file) }
}
function rehype() {
  const processor = this
  return tree => {
    counts.rehypeTransforms++
    const heading = tree.children.find(node => node.tagName === 'h1')
    heading.properties.id = '${dialect === 'markdown' ? 'Guide' : 'Page'}:Target:${epoch}'
    heading.children = [{ type: 'text', value: 'Build-time ${dialect === 'markdown' ? 'Guide' : 'Page'}' }]
    ${dialect === 'markdown' ? 'wrapCompiler(processor)' : ''}
  }
}
function recma() {
  const processor = this
  return () => { counts.recmaTransforms++; wrapCompiler(processor) }
}
const doc = content.${dialect}({ remarkPlugins: [remark], rehypePlugins: [rehype]${dialect === 'mdx' ? ', recmaPlugins: [recma]' : ''} })
export default defineConfig({
  collections: { posts: { pattern: '*.${dialect === 'markdown' ? 'md' : 'mdx'}', schema: s.object({
    name: s.string(), revision: s.number(),
    ${
      demand === 'source-only'
        ? 'short: doc.excerpt({ length: 18 }), excerpt: doc.excerpt({ length: 2048 }), metadata: doc.metadata()'
        : demand === 'toc-only'
          ? 'toc: doc.toc()'
          : `primary: doc.${dialect === 'markdown' ? 'html' : 'code'}()`
    }
  }).transform(async value => {
    ${
      demand === 'combined'
        ? `value = { ...value, toc: await doc.toc().parseAsync(undefined), short: await doc.excerpt({ length: 18 }).parseAsync(undefined), excerpt: await doc.excerpt({ length: 2048 }).parseAsync(undefined), metadata: await doc.metadata().parseAsync(undefined) }`
        : ''
    }
    counts.validations++
    return { ...value, epoch: ${epoch}, observation: { ...counts } }
  }) } }
})
`

const parseArgs = (argv: string[]): Options | 'help' => {
  const options = { docs: DEFAULT_DOCS, repeats: DEFAULT_REPEATS, json: false }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--') continue
    if (arg === '--help' || arg === '-h') return 'help'
    if (arg === '--json') options.json = true
    else if (arg === '--docs' || arg === '--repeats') {
      const value = Number(argv[++index])
      if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${arg} must be a positive safe integer`)
      options[arg === '--docs' ? 'docs' : 'repeats'] = value
    } else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

const memory = () => {
  const usage = process.memoryUsage()
  const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 100) / 100
  return { rssMb: mb(usage.rss), heapUsedMb: mb(usage.heapUsed), externalMb: mb(usage.external), arrayBuffersMb: mb(usage.arrayBuffers) }
}

const checkpointMemory = async () => {
  await setImmediate()
  globalThis.gc?.()
  return memory()
}

const summarize = (result: BuildResult, dialect: Dialect, demand: Demand, docs: number, epoch: number) => {
  deepEqual(result.diagnostics, [], 'benchmark records must build without diagnostics')
  const entries = result.output.collections.posts!.entries
  equal(entries.length, docs)
  const title = dialect === 'markdown' ? 'Guide' : 'Page'
  const expected: Values = {}
  if (demand === 'source-only' || demand === 'combined') {
    expected.short = `${title} Introductory…`
    expected.excerpt = dialect === 'markdown' ? `Guide ${expectedProse}` : `Page ${expectedProse} Static interactive note.`
    // Hand-counted: 78 prose words + 4 heading words; MDX adds 3 static JSX child words.
    expected.metadata = { readingTime: 1, wordCount: dialect === 'markdown' ? 82 : 85 }
  }
  if (demand === 'toc-only' || demand === 'combined') {
    expected.toc = [
      { depth: 1, title: `Build-time ${title}`, id: `${title}:Target:${epoch}` },
      { depth: 2, title: 'Installation', id: 'installation' },
      { depth: 2, title: 'Configuration', id: 'configuration' },
      { depth: 2, title: 'Troubleshooting', id: 'troubleshooting' }
    ]
  }
  let stages: Stages | undefined
  let sample: Values | undefined
  // Every plugin demand settles before its record stamp; the last validation stamp has the module totals.
  // Memoized records keep older stamps, so only the highest validation ordinal is used.
  for (const entry of entries) {
    const {
      name,
      revision,
      epoch: recordEpoch,
      observation,
      ...values
    } = entry.data as {
      name: string
      revision: number
      epoch: number
      observation: Stages
    } & Values
    equal(recordEpoch, epoch, 'configuration reload must replace all record results')
    const { primary, ...selections } = values
    deepEqual(selections, expected)
    if (demand === 'primary-only' || demand === 'combined') {
      equal(typeof primary, 'string')
      for (const id of [`${title}:Target:${epoch}`, 'installation', 'configuration', 'troubleshooting']) {
        ok(primary!.includes(dialect === 'markdown' ? `id="${id}"` : JSON.stringify(id)), 'generated content preserves actual targets')
      }
      ok(primary!.includes(`Build-time ${title}`))
    } else equal(primary, undefined)
    if (stages === undefined || observation.validations > stages.validations) stages = observation
    sample ??= values
  }
  return { records: entries.length, stages: stages!, values: sample! }
}

const expectedStages = (attempts: number, dialect: Dialect, demand: Demand): Stages => ({
  initializations: attempts,
  parses: attempts,
  remarkTransforms: demand === 'source-only' ? 0 : attempts,
  rehypeTransforms: demand === 'source-only' ? 0 : attempts,
  recmaTransforms: dialect === 'mdx' && demand !== 'source-only' ? attempts : 0,
  compilers: demand === 'primary-only' || demand === 'combined' ? attempts : 0,
  validations: attempts
})

const roundMs = (ms: number): number => Math.round(ms * 100) / 100

const runCase = async (root: string, dialect: Dialect, demand: Demand, options: Options, builder: typeof import('../dist/index.mjs').builder) => {
  const cwd = join(root, `${dialect}-${demand}`)
  const configPath = join(cwd, 'velite.config.ts')
  const file = (index: number) => join(cwd, 'content', `record-${index}.${dialect === 'markdown' ? 'md' : 'mdx'}`)
  const writeDocuments = async (revision: number) => {
    for (let index = 0; index < options.docs; index++) await writeFile(file(index), document(dialect, index, revision))
  }
  await mkdir(join(cwd, 'content'), { recursive: true })
  await writeFile(configPath, config(dialect, demand, 1))
  await writeDocuments(0)
  let instance: Builder | undefined = builder({ cwd, config: 'velite.config.ts', logLevel: 'silent' })
  try {
    const before = await checkpointMemory()
    let previous = expectedStages(0, dialect, demand)
    const measure = async (name: string, epoch: number, attempts: number, run: () => Promise<BuildResult | undefined>, captureValues = false) => {
      await checkpointMemory()
      const start = performance.now()
      let result = await run()
      const ms = roundMs(performance.now() - start)
      const endMemory = memory()
      ok(result, 'a benchmark build/event must produce a result')
      const observed = summarize(result, dialect, demand, options.docs, epoch)
      const stages = { ...observed.stages }
      for (const key of Object.keys(stages) as (keyof Stages)[]) stages[key] -= previous[key]
      deepEqual(stages, expectedStages(attempts, dialect, demand), `${name}: actual validation must own fresh requested stages`)
      previous = { ...observed.stages }
      result = undefined
      return {
        name,
        ms,
        epoch,
        records: observed.records,
        stages,
        endMemory,
        memory: await checkpointMemory(),
        ...(captureValues ? { values: observed.values } : {})
      }
    }
    const measurements: Measurement[] = []
    measurements.push(await measure('full build', 1, options.docs, () => instance!.build({ layout: 'single' }), true))
    measurements.push(await measure('no-op rebuild', 1, 0, () => instance!.build({ layout: 'single' })))

    // Frontmatter changes, but selected text stays exactly equal to the previous attempt.
    await writeFile(file(0), document(dialect, 0, 1))
    measurements.push(await measure('single-file incremental rebuild', 1, 1, () => instance!.apply([{ type: 'change', absPath: file(0) }])))

    await writeFile(configPath, config(dialect, demand, 2))
    previous = expectedStages(0, dialect, demand) // Module-owned counters restart in the replacement configuration.
    measurements.push(await measure('configuration reload', 2, options.docs, () => instance!.apply([{ type: 'change', absPath: configPath }]), true))

    for (let index = 0; index < options.repeats; index++) {
      await writeDocuments(index + 2)
      measurements.push(await measure(`revalidate all ${index + 1}`, 2, options.docs, () => instance!.build({ layout: 'single' })))
    }
    const start = performance.now()
    await instance.dispose()
    instance = undefined
    const disposal = { ms: roundMs(performance.now() - start), endMemory: memory(), memory: await checkpointMemory() }
    return { dialect, demand, selectedBytes: Buffer.byteLength(body(dialect)), before, measurements, disposal }
  } finally {
    await instance?.dispose()
  }
}

const environment = async () => {
  const names = [
    'velite',
    'zod',
    'unified',
    '@mdx-js/mdx',
    'terser',
    'jiti',
    'vfile',
    'remark-parse',
    'remark-gfm',
    'remark-rehype',
    'rehype-raw',
    'rehype-stringify'
  ]
  const dependencies = Object.fromEntries(
    await Promise.all(
      names.map(async name => {
        const url = new URL(name === 'velite' ? '../package.json' : `../node_modules/${name}/package.json`, import.meta.url)
        return [name, JSON.parse(await readFile(url, 'utf8')).version]
      })
    )
  )
  return {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    kernel: release(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    gcRequested: typeof globalThis.gc === 'function',
    jitiModuleCacheEnvironment: process.env.JITI_MODULE_CACHE ?? null,
    dependencies
  }
}

const runBenchmark = async (options: Options) => {
  const versions = await environment()
  const root = await mkdtemp(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'velite-content-bench-'))
  try {
    const { builder } = await import('../dist/index.mjs')
    const cases = []
    for (const dialect of ['markdown', 'mdx'] as const) {
      for (const demand of ['source-only', 'toc-only', 'primary-only', 'combined'] as const) cases.push(await runCase(root, dialect, demand, options, builder))
    }
    return {
      command: [
        ...(process.env.JITI_MODULE_CACHE === undefined ? [] : [`JITI_MODULE_CACHE=${process.env.JITI_MODULE_CACHE}`]),
        process.execPath,
        ...process.execArgv,
        ...process.argv.slice(1)
      ],
      environment: versions,
      root,
      workload: {
        docsPerCase: options.docs,
        cases: 8,
        repeatedRevalidations: options.repeats,
        assets: 0,
        layout: 'single',
        excerptLengths: [18, 2048],
        markdown: { gfm: true, removeComments: true, copyLinkedFiles: true },
        mdx: { gfm: true, removeComments: true, copyLinkedFiles: true, minify: true, outputFormat: 'function-body', development: false }
      },
      notes: [
        'Config self-reference imports velite through the packaged alias. Equal selected text occurs in distinct records and every fresh validation.',
        'Initialization counts one ordinary remark attacher per processor; parser/transform/compiler counts are ordinary plugin observations, not internal statistics.',
        'Combined selects primary first, then late navigation/source values. Literal source/metadata/navigation oracles and actual generated targets are checked for every record.',
        'Initial package import and Builder construction are outside elapsed time; build timings include config loading, validation, semantic capture, lazy dialect/minifier loading and output. Fixture edits, verification and GC/checkpoints are also excluded.',
        'Counters add bounded scalar record/output overhead. Serialization counters do not separately count minification; capture/initialization time is not isolated from other build work.',
        'Fixed case order shares warmed dependency/JIT caches; first uses can include lazy import costs. Repeat the command in fresh processes for comparable samples.',
        'No-op legitimately performs zero content work. Incremental/repeated builds change frontmatter only; reload changes the plugin target and replaces module-owned counters.',
        'Memory is sampled immediately after each operation and after an event-loop checkpoint with optional requested GC. Disposal drops the Builder reference; no raw trees/files or old full results are kept by this benchmark.',
        'The ADR 0003 native Promise observer adds temporary reactions; these are included in total costs, not exposed or counted as public statistics.',
        'These samples are not peak memory, a GC assertion, a universal plugin/concurrency guarantee or a performance threshold. Assets/two-pass validation are covered separately by bench-large and integration tests.'
      ],
      cases
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  if (options === 'help') {
    console.log(`Usage: node [--expose-gc] --import jiti/register scripts/bench-content.ts [--docs N] [--repeats N] [--json]
Defaults: ${DEFAULT_DOCS} equal selected documents per case, ${DEFAULT_REPEATS} repeated all-record revalidations.
Run pnpm build first. Temporary fixtures are removed automatically. MDX uses default minify=true.`)
    return
  }
  const result = await runBenchmark(options)
  if (options.json) console.log(JSON.stringify(result, null, 2))
  else {
    console.log(`Velite content benchmark: ${result.workload.docsPerCase} equal selected documents per case`)
    console.log(`command: ${result.command.join(' ')}`)
    console.log(`environment: ${JSON.stringify(result.environment)}`)
    console.log(`workload: ${JSON.stringify(result.workload)}`)
    for (const note of result.notes) console.log(note)
    for (const item of result.cases) {
      console.log(`${item.dialect}/${item.demand}, ${item.selectedBytes} selected bytes, before: ${JSON.stringify(item.before)}`)
      for (const point of item.measurements)
        console.log(`${point.name}: ${point.ms}ms, stages ${JSON.stringify(point.stages)}, memory ${JSON.stringify(point.memory)}`)
      console.log(`dispose: ${item.disposal.ms}ms, memory ${JSON.stringify(item.disposal.memory)}`)
    }
    console.log('Use --json for resulting values and immediate end-of-operation memory samples.')
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
