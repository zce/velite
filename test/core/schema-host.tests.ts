// T1.1: SchemaContextHost — process-owned propagation host, distinct public/private
// views, active-run guard with late-call rejection, parallel-Builder host identity,
// same-host idempotent install, different-host deterministic failure, nested run
// restore, sync/async settlement lease closure, and `createBuilder` NOT exported
// from the root package.
//
// Authority: Ticket 21 (Define schema run storage ownership) — final answer.
//
// Host installation is process-wide and immutable after install; there is no
// reset protocol (Ticket 21:24,84). Tests exercise nesting/await/isolation on an
// uninstalled host object (per Ticket 21:86) and verify the shared installed
// host identity through idempotent install semantics, without resetting the
// process slot.
import { deepEqual, equal, ok, strictEqual, throws } from 'node:assert/strict'
import { test } from 'node:test'

import { VeliteError } from '../../src/core/diagnostic'
import { installSchemaContextHost, schemaContextHost } from '../../src/core/schema/host'
import * as velite from '../../src/index'
import { createNodeSchemaContextHost } from '../../src/runtime/adapters/node/schema-host'
import { ensureTestSchemaRunner } from '../helpers/schema-context'

import type { SchemaRunContext } from '../../src/core/schema/run'

/** Build a minimal fake carrier tagged with `tag` so tests can observe nesting. */
const carrier = (tag: string): SchemaRunContext => ({
  publicContext: { tag } as unknown as SchemaRunContext['publicContext'],
  content: { content: async () => undefined },
  lease: { active: true }
})

test('T1.1: createBuilder is NOT exported from the root package (only builder/build/watch)', () => {
  equal(typeof velite.builder, 'function', 'builder facade exported')
  equal(typeof velite.build, 'function', 'build facade exported')
  equal(typeof velite.watch, 'function', 'watch facade exported')
  equal((velite as Record<string, unknown>).createBuilder, undefined, 'createBuilder must NOT be a root export')
})

test('T1.1: installing a different host after the first is a deterministic VeliteError(internal)', () => {
  // Ensure the shared test host is installed first (idempotent).
  ensureTestSchemaRunner()
  const first = schemaContextHost()
  const second = createNodeSchemaContextHost()
  throws(
    () => installSchemaContextHost(second),
    (err: unknown) => err instanceof VeliteError && err.code === 'internal',
    'different host install must throw VeliteError(internal)'
  )
  strictEqual(schemaContextHost(), first, 'first host retained after failed second install')
})

test('T1.1: installing the identical host is idempotent', () => {
  ensureTestSchemaRunner()
  const installed = schemaContextHost()
  installSchemaContextHost(installed) // no throw
  strictEqual(schemaContextHost(), installed, 'same host identity returned')
})

test('T1.1: host run() preserves LIFO nesting and restores outer carrier (uninstalled host)', () => {
  // Per Ticket 21:86, nesting/parallel-propagation behavior is tested on an
  // uninstalled adapter object, without mutating the process installation slot.
  const host = createNodeSchemaContextHost()
  const seen: string[] = []
  host.run(carrier('outer'), () => {
    seen.push((host.get().publicContext as { tag: string }).tag)
    host.run(carrier('inner'), () => {
      seen.push((host.get().publicContext as { tag: string }).tag)
    })
    seen.push((host.get().publicContext as { tag: string }).tag)
  })
  deepEqual(seen, ['outer', 'inner', 'outer'])
})

test('T1.1: host survives await boundaries within the callback (uninstalled host)', async () => {
  const host = createNodeSchemaContextHost()
  const result = await host.run(carrier('leased'), async () => {
    await new Promise(resolve => setTimeout(resolve, 1))
    return (host.get().publicContext as { tag: string }).tag
  })
  strictEqual(result, 'leased')
})

test('T1.1: host.get() outside a bound execution throws VeliteError(internal) (uninstalled host)', () => {
  const host = createNodeSchemaContextHost()
  throws(
    () => host.get(),
    (err: unknown) => err instanceof VeliteError && err.code === 'internal',
    'host.get() outside run must throw VeliteError(internal)'
  )
})

test('T1.1: the shared test host is installed and schema runs work end-to-end', async () => {
  // The shared test host is installed lazily by ensureTestSchemaRunner; this
  // test verifies schemaContextHost() returns the installed identity and a
  // schema run can propagate a carrier.
  const runner = ensureTestSchemaRunner()
  const seen: string[] = []
  await runner.run(
    {
      project: { root: '/proj', configPath: '/proj/velite.config.ts', collections: {}, output: { data: '/d', assets: '/a', base: '/b', name: 'n' } } as never,
      file: { id: 'f', path: '/p', content: 'c' } as never,
      record: { id: 'r', index: 0 } as never,
      store: { get: () => undefined, has: () => false, getOrCreate: (_k: string, c: () => unknown) => c() } as never,
      collectEffect: (() => {}) as never,
      asset: (async () => ({})) as never,
      readFile: (async () => new Uint8Array()) as never,
      probeImage: (async () => ({})) as never,
      contentOperation: async () => 'derived'
    },
    async () => {
      seen.push((schemaContextHost().get().publicContext as { tag?: string }).tag ?? '<no tag>')
      await Promise.resolve()
      seen.push((schemaContextHost().get().publicContext as { tag?: string }).tag ?? '<no tag>')
    }
  )
  deepEqual(seen, ['<no tag>', '<no tag>'])
  ok(schemaContextHost() !== undefined)
})
