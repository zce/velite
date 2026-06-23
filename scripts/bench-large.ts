import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

interface Options {
  docs: number
  assets: number
  json: boolean
  keep: boolean
  dir?: string
}

interface Measurement {
  name: string
  ms: number
  rssMb: number
  heapUsedMb: number
}

const DEFAULT_DOCS = 20_000
const DEFAULT_ASSETS = 20_000

const usage = (): string => `
Usage: pnpm bench:large -- [options]

Generate a large temporary Velite project and measure build performance.

Options:
  --docs <n>     Number of content documents to generate (default ${DEFAULT_DOCS})
  --assets <n>   Number of companion asset files to generate (default ${DEFAULT_ASSETS})
  --dir <path>   Use an existing/new directory instead of a temp directory
  --json         Print machine-readable JSON only
  --keep         Keep generated fixture directory after the run
  --help         Show this help
`

const parseNumber = (name: string, value: string | undefined): number => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`)
  return parsed
}

const parseArgs = (argv: string[]): Options | 'help' => {
  const options: Options = { docs: DEFAULT_DOCS, assets: DEFAULT_ASSETS, json: false, keep: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--') continue
    if (arg === '--help' || arg === '-h') return 'help'
    if (arg === '--json') options.json = true
    else if (arg === '--keep') options.keep = true
    else if (arg === '--docs') options.docs = parseNumber('--docs', argv[++i])
    else if (arg === '--assets') options.assets = parseNumber('--assets', argv[++i])
    else if (arg === '--dir') options.dir = argv[++i]
    else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

const formatMb = (bytes: number): number => Math.round((bytes / 1024 / 1024) * 10) / 10

const measure = async (name: string, run: () => Promise<unknown>): Promise<Measurement> => {
  globalThis.gc?.()
  const start = performance.now()
  await run()
  const ms = performance.now() - start
  const memory = process.memoryUsage()
  return { name, ms: Math.round(ms * 10) / 10, rssMb: formatMb(memory.rss), heapUsedMb: formatMb(memory.heapUsed) }
}

const frontmatter = (title: string, asset: string): string => `---
title: ${JSON.stringify(title)}
asset: ${JSON.stringify(asset)}
---
`

const markdownBody = (index: number, asset: string): string => `${frontmatter(`Guide ${index}`, asset)}
Introductory documentation for guide ${index}. This paragraph mirrors the kind of content found in real project docs: it explains the concept, names a few options, and links the surrounding sections together for readers.

![Linked asset](${asset})

## Installation

Install the package, add a configuration file, and run the build command. The content intentionally includes enough prose to exercise markdown parsing, plain-text extraction, and table-of-contents generation instead of only validating a tiny fixture.

## Configuration

Configuration usually combines collection definitions, schema transforms, output settings, and a few examples. This benchmark repeats a realistic amount of text so the parser does meaningful work on every document.

- Define collections for articles and pages.
- Use markdown, toc, excerpt, and linked file assets.
- Keep examples short enough to read but large enough to matter.

## Troubleshooting

When output looks stale, rerun the build, inspect linked assets, and verify that schema fields still match the frontmatter. These paragraphs approximate normal documentation size without becoming synthetic megabyte blobs.
`

const mdxBody = (index: number, asset: string): string => `${frontmatter(`Page ${index}`, asset)}
export const Example = () => <strong>Page ${index}</strong>

# Overview

This MDX page represents interactive documentation with JSX, markdown headings, local assets, and regular explanatory prose. It should make the benchmark touch the MDX compiler path rather than only the cheaper JSON loader path.

![Linked asset](${asset})

## Interactive Example

<Example />

The example is deliberately small, but the surrounding copy is similar to a practical documentation page. It describes usage, constraints, and expected output in several complete sentences.

## Details

MDX builds are more expensive than plain markdown because they compile into executable module code. Including them in this benchmark keeps the measured path representative of projects that mix prose and components.
`

const writeFixture = async (root: string, docs: number, assets: number): Promise<{ changedDoc: string }> => {
  await writeFile(
    join(root, 'velite.config.ts'),
    `import { defineConfig, s } from 'velite'

export default defineConfig({
  root: 'content',
  collections: {
    guides: {
      pattern: 'guides/*.md',
      schema: s.object({
        title: s.string(),
        asset: s.file(),
        html: s.markdown(),
        toc: s.toc(),
        excerpt: s.excerpt()
      })
    },
    pages: {
      pattern: 'pages/*.mdx',
      schema: s.object({
        title: s.string(),
        asset: s.file(),
        code: s.mdx(),
        toc: s.toc(),
        excerpt: s.excerpt()
      })
    }
  }
})
`
  )

  const assetBytes = new Uint8Array(256)
  for (let i = 0; i < assetBytes.length; i++) assetBytes[i] = i % 251

  for (let i = 0; i < assets; i++) {
    await writeFile(join(root, 'content', 'assets', `asset-${i}.bin`), assetBytes)
  }

  const guideCount = Math.ceil(docs / 2)
  for (let i = 0; i < docs; i++) {
    const asset = `../assets/asset-${i % assets}.bin`
    if (i < guideCount) await writeFile(join(root, 'content', 'guides', `guide-${i}.md`), markdownBody(i, asset))
    else await writeFile(join(root, 'content', 'pages', `page-${i - guideCount}.mdx`), mdxBody(i - guideCount, asset))
  }

  return { changedDoc: join(root, 'content', 'guides', 'guide-0.md') }
}

const ensureDirs = async (root: string): Promise<void> => {
  await mkdir(root, { recursive: true })
  await Promise.all([
    writeFile(join(root, '.gitkeep'), ''),
    mkdir(join(root, 'content', 'guides'), { recursive: true }),
    mkdir(join(root, 'content', 'pages'), { recursive: true }),
    mkdir(join(root, 'content', 'assets'), { recursive: true })
  ])
}

const runBenchmark = async (options: Options): Promise<{ root: string; docs: number; assets: number; measurements: Measurement[] }> => {
  const root = options.dir ?? (await mkdtemp(join(tmpdir(), 'velite-large-bench-')))
  await ensureDirs(root)
  const { changedDoc } = await writeFixture(root, options.docs, options.assets)

  const { builder } = await import('../dist/index.mjs')
  const instance = builder({ cwd: root, config: 'velite.config.ts', logLevel: 'silent' })
  try {
    const measurements: Measurement[] = []
    measurements.push(await measure('full build', () => instance.build({ layout: 'single' })))
    measurements.push(await measure('no-op rebuild', () => instance.build({ layout: 'single' })))

    await writeFile(changedDoc, markdownBody(0, '../assets/asset-0.bin').replace('Guide 0', 'Guide 0 updated'))
    measurements.push(await measure('single-file incremental rebuild', () => instance.apply([{ type: 'change', absPath: changedDoc }])))

    return { root, docs: options.docs, assets: options.assets, measurements }
  } finally {
    await instance.dispose()
    if (!options.keep && options.dir === undefined) await rm(root, { recursive: true, force: true })
  }
}

const printSummary = (result: Awaited<ReturnType<typeof runBenchmark>>, json: boolean): void => {
  if (json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }
  console.log(`Velite large benchmark`)
  console.log(`fixture: ${result.docs} docs, ${result.assets} assets`)
  console.log(`root: ${result.root}`)
  for (const item of result.measurements) {
    console.log(`${item.name}: ${item.ms}ms, rss ${item.rssMb}MB, heap ${item.heapUsedMb}MB`)
  }
}

const main = async (): Promise<void> => {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed === 'help') {
    console.log(usage().trim())
    return
  }
  const result = await runBenchmark(parsed)
  printSummary(result, parsed.json)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
