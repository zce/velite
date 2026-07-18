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
