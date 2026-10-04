import { deepEqual, equal, ok, strictEqual } from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

import * as velite from '../src/index'

const exec = promisify(execFile)

test('api: exports the public surface', () => {
  const names = ['build', 'watch', 'builder', 's', 'content', 'context', 'defineConfig', 'defineCollection', 'defineLoader', 'defineSchema']
  for (const name of names) {
    ok(typeof (velite as Record<string, unknown>)[name] !== 'undefined', `missing export: ${name}`)
  }
  // createBuilder must NOT be a root export (Ticket 21).
  equal((velite as Record<string, unknown>).createBuilder, undefined, 'createBuilder must not be a root export')
})

test('api: content exports finite definitions, not legacy schema roots or standalone selections', () => {
  deepEqual(Reflect.ownKeys(velite.content).sort(), ['markdown', 'mdx'])
  equal(typeof velite.content.markdown, 'function')
  equal(typeof velite.content.mdx, 'function')
  const markdown = velite.content.markdown()
  const mdx = velite.content.mdx()
  deepEqual(Reflect.ownKeys(markdown).sort(), ['excerpt', 'html', 'metadata', 'toc'])
  deepEqual(Reflect.ownKeys(mdx).sort(), ['code', 'excerpt', 'metadata', 'toc'])
  for (const definition of [markdown, mdx]) {
    for (const name of ['parse', 'parseAsync', 'safeParseAsync', 'optional', 'transform', 'project', 'close']) {
      equal((definition as unknown as Record<string, unknown>)[name], undefined, `a definition must not expose ${name}`)
    }
  }

  const s = velite.s as Record<string, unknown>
  for (const name of ['markdown', 'mdx', 'toc', 'excerpt', 'metadata', 'content']) {
    equal(s[name], undefined, `legacy s.${name} must not be exported`)
    ok(!Object.hasOwn(s, name), `s must not retain an own ${name} property`)
  }
  for (const name of [
    'markdown',
    'mdx',
    'toc',
    'excerpt',
    'metadata',
    'original',
    'MarkdownRoot',
    'MdxRoot',
    'MarkdownSchemaOptions',
    'MdxSchemaOptions',
    'TocOptions'
  ]) {
    equal((velite as Record<string, unknown>)[name], undefined, `legacy root export must be absent: ${name}`)
  }
})

test('api: internal content execution machinery remains private', () => {
  const internals = [
    'PristineArtifact',
    'VFileSeed',
    'ParseMessageSeed',
    'ContentDialectAdapter',
    'ContentBranch',
    'RecordBroker',
    'ContentArtifactsFactory',
    'UnsupportedSeedValueError',
    'ParseIdentity',
    'ProfileIdentity',
    'OpaquePristineTree',
    'OpaqueBranchTree',
    'RecordScope',
    'DialectAdapterPair',
    'BrokerFactoryDeps',
    'ContentResult',
    'ContentDefinitionDescriptor',
    'SemanticContentRequest',
    'ContentStageScope',
    'ContentExecutionsDeps',
    'ContentExecutionsFactory',
    'ContentRecordScope',
    'RecordContent',
    'RecordContentCapability',
    'ContentRequest',
    'SchemaContextHost',
    'SchemaRunContext',
    'ContentPromise',
    'PromiseObserver',
    'NodePromiseObserver',
    'NodePromiseObserverDeps',
    'SchemaRunnerDeps',
    'createNodePromiseObserver',
    'createContentExecutionsFactory',
    'createDefaultContentExecutionsFactory',
    'createMarkdownExecution',
    'createMdxExecution',
    'createOwnedProcessor',
    'createSchemaRunner',
    'installSchemaContextHost',
    'schemaContextHost',
    'contentContext'
  ]
  for (const name of internals) {
    equal((velite as Record<string, unknown>)[name], undefined, `root package must not export internal content machinery: ${name}`)
  }
})

test('api: createBuilder depends on explicit runtime capabilities', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'velite-api-contract-'))
  const file = join(dir, 'contract.ts')
  await writeFile(
    file,
    `
      import type { BuilderDeps } from '${join(process.cwd(), 'src/core/builder.ts')}'
      import type { FileSystem, ImageProcessor, Logger, ModuleLoader, Watcher } from '${join(process.cwd(), 'src/runtime/index.ts')}'
      import type { SchemaRunner } from '${join(process.cwd(), 'src/core/schema/runner.ts')}'

      type HasRuntime = 'runtime' extends keyof BuilderDeps ? true : false
      type HasExplicitDeps = BuilderDeps extends {
        fs: FileSystem
        modules: ModuleLoader
        schemaRunner: SchemaRunner
        logger: Logger
        image: ImageProcessor
        watch: (paths: string[]) => Watcher
      } ? true : false

      const noRuntime: false = null as never as HasRuntime
      const explicitDeps: true = null as never as HasExplicitDeps
      void noRuntime
      void explicitDeps
    `
  )

  try {
    const result = await exec('pnpm', [
      'exec',
      'tsc',
      '--noEmit',
      '--ignoreConfig',
      '--strict',
      '--skipLibCheck',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      '--target',
      'ES2022',
      '--types',
      'node',
      '--allowImportingTsExtensions',
      file
    ])
    strictEqual(result.stderr, '')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('api: runtime barrel exposes ports, not a bundled Runtime contract', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'velite-runtime-contract-'))
  const file = join(dir, 'contract.ts')
  await writeFile(
    file,
    `
      import type { FileSystem, ImageProcessor, Logger, ModuleLoader, Watcher } from '${join(process.cwd(), 'src/runtime/index.ts')}'
      // @ts-expect-error Runtime is intentionally not a public bundled contract.
      import type { Runtime } from '${join(process.cwd(), 'src/runtime/index.ts')}'
      // @ts-expect-error ContextStorage is removed — SchemaContextHost replaces it.
      import type { ContextStorage } from '${join(process.cwd(), 'src/runtime/index.ts')}'

      type HasPorts = [FileSystem, ModuleLoader, Logger, ImageProcessor, Watcher]
      const hasPorts: HasPorts | undefined = undefined
      void hasPorts
    `
  )

  try {
    const result = await exec('pnpm', [
      'exec',
      'tsc',
      '--noEmit',
      '--ignoreConfig',
      '--strict',
      '--skipLibCheck',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      '--target',
      'ES2022',
      '--types',
      'node',
      '--allowImportingTsExtensions',
      file
    ])
    strictEqual(result.stderr, '')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
