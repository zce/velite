import { equal, ok, strictEqual } from 'node:assert'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

import * as velite from '../src/index'

const exec = promisify(execFile)

test('api: exports the public surface', () => {
  const names = ['build', 'watch', 'builder', 's', 'defineConfig', 'defineCollection']
  for (const name of names) {
    ok(typeof (velite as Record<string, unknown>)[name] !== 'undefined', `missing export: ${name}`)
  }
  // createBuilder must NOT be a root export (Ticket 21).
  equal((velite as Record<string, unknown>).createBuilder, undefined, 'createBuilder must not be a root export')
  // Top-level s.toc / s.excerpt / s.metadata are removed; use root methods.
  const s = velite.s as Record<string, unknown>
  equal(s.toc, undefined, 's.toc must not be a root projection (use s.markdown().toc() / s.mdx().toc())')
  equal(s.excerpt, undefined, 's.excerpt must not be a root projection (use s.markdown().excerpt() / s.mdx().excerpt())')
  equal(s.metadata, undefined, 's.metadata must not be a root projection (use s.markdown().metadata() / s.mdx().metadata())')
  ok(typeof s.markdown === 'function', 's.markdown is a function (the dialect root)')
  ok(typeof s.mdx === 'function', 's.mdx is a function (the dialect root)')
  const mdRoot = (s.markdown as () => { toc(): unknown; excerpt(): unknown; metadata(): unknown })()
  ok(typeof mdRoot.toc === 'function', 's.markdown() root exposes .toc()')
  ok(typeof mdRoot.excerpt === 'function', 's.markdown() root exposes .excerpt()')
  ok(typeof mdRoot.metadata === 'function', 's.markdown() root exposes .metadata()')
  const mdxRoot = (s.mdx as () => { toc(): unknown; excerpt(): unknown; metadata(): unknown })()
  ok(typeof mdxRoot.toc === 'function', 's.mdx() root exposes .toc()')
  ok(typeof mdxRoot.excerpt === 'function', 's.mdx() root exposes .excerpt()')
  ok(typeof mdxRoot.metadata === 'function', 's.mdx() root exposes .metadata()')
  // T2.3: record-scoped content derivation internal types must NOT be exported.
  const internalTypes = [
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
    'BrokerFactoryDeps'
  ]
  for (const name of internalTypes) {
    equal((velite as Record<string, unknown>)[name], undefined, `root package must not export internal derivation type: ${name}`)
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
