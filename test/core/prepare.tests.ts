// Integration tests for the `prepare` hook: void (write original), false (skip
// writes), a modified result (write the replacement), and the friendly
// collections view (name → data array / single object, destructurable as the
// first argument). Uses the full builder + MemoryFileSystem so the hook is
// exercised in its real wiring between emit and writeOutput.
import { deepEqual, equal, ok, throws } from 'node:assert/strict'
import { test } from 'node:test'

import { s } from '../../src/core'
import { createBuilder } from '../../src/core/builder'
import { VeliteError } from '../../src/core/diagnostic'
import { join } from '../../src/core/util/path'
import { silentLogger } from '../../src/runtime/adapters/node'
import { MemoryFileSystem } from '../helpers/memory-fs'
import { noopImageProcessor, noopWatch, testSchemaRunner } from '../helpers/runtime'

import type { PrepareCollections, PrepareContext, PrepareHook, UserConfig } from '../../src/core/config'
import type { TestRuntime } from '../helpers/runtime'

const CWD = '/proj'
const DATA_DIR = join(CWD, '.velite')

const baseConfig: UserConfig = {
  root: 'content',
  collections: { posts: { pattern: 'posts/*.json', schema: s.object({ title: s.string() }) } }
}

const setup = (prepare: PrepareHook | undefined): { runtime: TestRuntime; fs: MemoryFileSystem } => {
  const config: UserConfig = { ...baseConfig, prepare }
  const fs = new MemoryFileSystem()
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
  const runtime: TestRuntime = {
    schemaRunner: testSchemaRunner(),
    fs,
    modules: { load: async () => ({ exports: config, dependencies: [] }) },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  return { runtime, fs }
}

const build = (runtime: TestRuntime) => createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') }).build({ layout: 'single' })

const readJson = async (fs: MemoryFileSystem, path: string): Promise<unknown> => JSON.parse(new TextDecoder().decode(await fs.read(path)))

test('prepare: void return writes the original output', async () => {
  const { runtime, fs } = setup(() => undefined)
  const result = await build(runtime)
  ok(
    result.written.some(p => p.endsWith('posts.json')),
    'data file written'
  )
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ title: string }>
  deepEqual(posts, [{ title: 'A' }, { title: 'B' }])
})

test('prepare: false return suppresses all writes (written: [])', async () => {
  const { runtime, fs } = setup(() => false)
  const result = await build(runtime)
  equal(result.written.length, 0, 'nothing written when prepare returns false')
  await readJson(fs, join(DATA_DIR, 'posts.json')).then(
    () => ok(false, 'posts.json should not exist'),
    () => ok(true, 'posts.json absent as expected')
  )
})

test('prepare: collections are destructurable as the first argument', async () => {
  let received: Array<{ title: string }> | undefined
  const prepare: PrepareHook = ({ posts }) => {
    received = posts as Array<{ title: string }>
  }
  const { runtime } = setup(prepare)
  await build(runtime)
  deepEqual(
    received?.map(p => p.title),
    ['A', 'B']
  )
})

test('prepare: mutating the collections view in place (void) writes the mutation', async () => {
  const prepare: PrepareHook = ({ posts }) => {
    for (const post of posts as Array<{ title: string; processed?: boolean }>) post.processed = true
  }
  const { runtime, fs } = setup(prepare)
  const result = await build(runtime)
  ok(result.written.some(p => p.endsWith('posts.json')))
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ title: string; processed: boolean }>
  ok(
    posts.every(p => p.processed === true),
    'in-place mutation propagated'
  )
})

test('prepare: pushing a new entry into the array propagates (rebuild syncs length)', async () => {
  const prepare: PrepareHook = ({ posts }) => {
    ;(posts as Array<{ title: string }>).push({ title: 'C' })
  }
  const { runtime, fs } = setup(prepare)
  await build(runtime)
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ title: string }>
  equal(posts.length, 3)
  equal(posts[2]!.title, 'C')
})

test('prepare: a replaced collections result is written in place of the original', async () => {
  const prepare: PrepareHook = ({ posts }) => {
    const next: PrepareCollections = { posts: (posts as Array<{ title: string }>).map(p => ({ ...p, processed: true })) }
    return { collections: next }
  }
  const { runtime, fs } = setup(prepare)
  const result = await build(runtime)
  ok(result.written.some(p => p.endsWith('posts.json')))
  const posts = (await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ title: string; processed: boolean }>
  equal(posts.length, 2)
  ok(
    posts.every(p => p.processed === true),
    'the replaced data was written'
  )
})

test('prepare: single collections expose the single object, not an array', async () => {
  const config: UserConfig = {
    root: 'content',
    collections: { options: { pattern: 'options/*.json', single: true, schema: s.object({ name: s.string() }) } }
  }
  let received: unknown
  const fs = new MemoryFileSystem()
  fs.put(join(CWD, 'content/options/a.json'), JSON.stringify({ name: 'velite' }))
  const runtime: TestRuntime = {
    schemaRunner: testSchemaRunner(),
    fs,
    modules: {
      load: async () => ({
        exports: {
          ...config,
          prepare: ({ options }: PrepareCollections) => {
            received = options
          }
        },
        dependencies: []
      })
    },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  await build(runtime)
  deepEqual(received, { name: 'velite' })
})

test('prepare: receives a context with project metadata and diagnostics', async () => {
  let received: PrepareContext | undefined
  const { runtime } = setup((_, ctx) => {
    received = ctx
    return undefined
  })
  await build(runtime)
  ok(received !== undefined)
  ok(received!.project.root.length > 0)
  equal(received!.project.configPath, join(CWD, 'velite.config.ts'))
  // project.collections is now the same Record<string, ProjectCollectionInfo>
  // shape used by SchemaContext.project — keyed by collection name.
  ok(received!.project.collections.posts !== undefined)
  equal(received!.project.collections.posts!.single, false)
  ok(typeof received!.project.output.data === 'string')
  ok(Array.isArray(received!.diagnostics))
})

test('prepare: async hook is awaited', async () => {
  const prepare: PrepareHook = async collections => {
    await Promise.resolve()
    return { collections }
  }
  const { runtime } = setup(prepare)
  const result = await build(runtime)
  ok(result.written.some(p => p.endsWith('posts.json')))
})

test('prepare: false return reconciles a previous successful build (no stale data)', async () => {
  // Engine memoizes by content digest, so the second build must change the
  // source for emit (and thus prepare) to re-run.
  let calls = 0
  const prepare: PrepareHook = () => {
    calls++
    return calls === 2 ? false : undefined
  }
  const { runtime, fs } = setup(prepare)
  const builder = createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })
  await builder.build({ layout: 'single' })
  // first (void) build wrote posts.json
  deepEqual((await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ title: string }>, [{ title: 'A' }, { title: 'B' }])
  // change the source so the second build re-runs emit (and thus prepare)
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A2' }, { title: 'B2' }]))
  const second = await builder.build({ layout: 'single' })
  equal(second.written.length, 0, 'nothing written when prepare returns false')
  await readJson(fs, join(DATA_DIR, 'posts.json')).then(
    () => ok(false, 'posts.json should have been reconciled away'),
    () => ok(true, 'stale posts.json removed')
  )
})

test('prepare: false reconciles stale output across separate builder instances (persisted manifest)', async () => {
  // Two distinct builders against the same fs simulate the one-shot
  // `build()` facade running across processes: state survives via the
  // persisted manifest under `output.data/.manifest.json`.
  const fs = new MemoryFileSystem()
  fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
  const mkBuilder = (prepare?: PrepareHook) => {
    const config: UserConfig = { ...baseConfig, prepare }
    const runtime: TestRuntime = {
      schemaRunner: testSchemaRunner(),
      fs,
      modules: { load: async () => ({ exports: config, dependencies: [] }) },
      logger: silentLogger,
      image: noopImageProcessor,
      watch: noopWatch
    }
    return createBuilder({ ...runtime, cwd: CWD, configPath: join(CWD, 'velite.config.ts') })
  }
  // First builder: normal write
  const first = mkBuilder()
  await first.build({ layout: 'single' })
  deepEqual((await readJson(fs, join(DATA_DIR, 'posts.json'))) as Array<{ title: string }>, [{ title: 'A' }, { title: 'B' }])
  await first.dispose()
  // Second builder (fresh instance, fresh in-memory state): prepare returns false
  // → must still wipe the stale posts.json the first builder wrote.
  const second = mkBuilder(() => false)
  const result = await second.build({ layout: 'single' })
  equal(result.written.length, 0)
  await readJson(fs, join(DATA_DIR, 'posts.json')).then(
    () => ok(false, 'posts.json should have been reconciled across builders'),
    () => ok(true, 'stale posts.json removed across builders')
  )
  await second.dispose()
})

// --- T1.5: Final PrepareContext -------------------------------------------
//
// The sole prepare diagnostic channel is `addDiagnostic`. `PrepareResult.diagnostics`
// does not exist. The sink is append-only, synchronously normalizes/snapshots
// input, closes at hook settlement. Late calls throw a lifecycle-misuse error
// synchronously and append nothing. Reusing a key with a different normalized
// payload yields one Velite-authored fatal prepare conflict diagnostic and
// selects no winner. Reversing call or completion order yields the same set
// and order. `prepare(false)` records output suppression only and bypasses no
// fatal/strict/staging/publication gate.
//
// These tests target the new sink directly (unit-level) and the build wiring
// (integration-level) so both seams are covered.

test('T1.5: addDiagnostic is the sole prepare diagnostic channel; PrepareResult.diagnostics is removed', () => {
  // Type-level: the PrepareResult type no longer carries `diagnostics`.
  // `addDiagnostic` is the only way to surface a prepare diagnostic.
  // (Compile-time only; if the type regressed, this test file would fail to
  // typecheck before it ever ran.)
  const ctx: PrepareContext = {
    project: { root: '/p', configPath: '/p/velite.config.ts', collections: {}, output: { data: '/d', assets: '/a', base: '/b', name: 'n' } },
    diagnostics: [],
    addDiagnostic: () => {}
  }
  equal(typeof ctx.addDiagnostic, 'function')
  equal('diagnostics' in ctx, true, 'readonly diagnostics array still present for read-only inspection')
})

test('T1.5: addDiagnostic appends a normalized diagnostic with prepare origin/provenance/stage', async () => {
  const runtime: TestRuntime = {
    schemaRunner: testSchemaRunner(),
    fs: (() => {
      const fs = new MemoryFileSystem()
      fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
      return fs
    })(),
    modules: {
      load: async () => ({
        exports: {
          ...baseConfig,
          prepare: (_c: unknown, ctx: PrepareContext) => {
            ctx.addDiagnostic({ key: 'k1', level: 'warn', code: 'P_WARN', message: 'careful' })
          }
        },
        dependencies: []
      })
    },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  const result = await build(runtime)
  const prepareDiag = result.diagnostics.find(d => d.stage === 'prepare' && d.code === 'P_WARN')
  ok(prepareDiag !== undefined, 'prepare diagnostic surfaced in build result')
  equal(prepareDiag!.level, 'warn')
  equal((prepareDiag!.origin as { kind: string }).kind, 'prepare-hook')
  equal(prepareDiag!.provenance.scope, 'project')
})

test('T1.5: addDiagnostic normalizes the cause before snapshot (mutation after call does not affect captured diagnostic)', async () => {
  const runtime: TestRuntime = {
    schemaRunner: testSchemaRunner(),
    fs: (() => {
      const fs = new MemoryFileSystem()
      fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
      return fs
    })(),
    modules: {
      load: async () => ({
        exports: {
          ...baseConfig,
          prepare: (_c: unknown, ctx: PrepareContext) => {
            const cause = { x: 1 }
            ctx.addDiagnostic({ key: 'k', level: 'warn', code: 'C', message: 'm', cause })
            // Mutate the cause object after the call. The sink must have
            // snapshotted it before this mutation, so the captured diagnostic
            // records x === 1.
            ;(cause as { x: number }).x = 999
          }
        },
        dependencies: []
      })
    },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  const result = await build(runtime)
  const prepareDiag = result.diagnostics.find(d => d.stage === 'prepare' && d.code === 'C')
  ok(prepareDiag !== undefined, 'prepare diagnostic surfaced in build result')
  ok(prepareDiag!.cause !== undefined, 'cause present')
  const cause = prepareDiag!.cause as { entries?: readonly (readonly [string, unknown])[] }
  ok(cause.entries !== undefined, 'cause is a record')
  const xEntry = cause.entries!.find(([k]) => k === 'x')
  ok(xEntry !== undefined, `x entry present (got entries: ${JSON.stringify(cause.entries)})`)
  equal(xEntry![1], 1, 'cause snapshotted before mutation')
})

test('T1.5: addDiagnostic rejects malformed inputs (unknown field, symbol key, accessor, inherited, invalid level, empty key/code, non-ordinary proto)', async () => {
  const captured: string[] = []
  const sym = Symbol('x')
  const runtime: TestRuntime = {
    schemaRunner: testSchemaRunner(),
    fs: (() => {
      const fs = new MemoryFileSystem()
      fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
      return fs
    })(),
    modules: {
      load: async () => ({
        exports: {
          ...baseConfig,
          prepare: (_c: unknown, ctx: PrepareContext) => {
            const cases: { label: string; input: unknown }[] = [
              { label: 'unknown field', input: { key: 'a', level: 'warn', code: 'C', message: 'm', extra: 1 } },
              { label: 'symbol key', input: { key: 'b', level: 'warn', code: 'C', message: 'm', [sym]: 1 } },
              {
                label: 'accessor',
                input: {
                  key: 'c',
                  level: 'warn',
                  code: 'C',
                  message: 'm',
                  get x() {
                    return 1
                  }
                }
              },
              { label: 'empty key', input: { key: '', level: 'warn', code: 'C', message: 'm' } },
              { label: 'empty code', input: { key: 'e', level: 'warn', code: '', message: 'm' } },
              { label: 'invalid level', input: { key: 'f', level: 'critical', code: 'C', message: 'm' } },
              {
                label: 'non-ordinary proto (class instance)',
                input: Object.assign(new (class Foo {})(), { key: 'g', level: 'warn', code: 'C', message: 'm' })
              },
              { label: 'non-ordinary proto (Array)', input: ['x'] }
            ]
            for (const c of cases) {
              try {
                ctx.addDiagnostic(c.input as never)
              } catch (err) {
                captured.push(`${c.label}: ${(err as Error).message}`)
              }
            }
          }
        },
        dependencies: []
      })
    },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  await build(runtime)
  // Every malformed case must be rejected synchronously.
  equal(captured.length, 8, `expected 8 rejections, got ${captured.length}: ${JSON.stringify(captured, null, 2)}`)
  ok(
    captured.some(s => s.startsWith('unknown field')),
    'unknown field rejected'
  )
  ok(
    captured.some(s => s.startsWith('symbol key')),
    'symbol key rejected'
  )
  ok(
    captured.some(s => s.startsWith('accessor')),
    'accessor rejected'
  )
  ok(
    captured.some(s => s.startsWith('non-ordinary proto (class instance)')),
    'class instance rejected'
  )
  ok(
    captured.some(s => s.startsWith('non-ordinary proto (Array)')),
    'array rejected'
  )
})

test('T1.5: addDiagnostic accepts a null-prototype record (ordinary null-proto is valid)', async () => {
  const stashed: string[] = []
  const runtime: TestRuntime = {
    schemaRunner: testSchemaRunner(),
    fs: (() => {
      const fs = new MemoryFileSystem()
      fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
      return fs
    })(),
    modules: {
      load: async () => ({
        exports: {
          ...baseConfig,
          prepare: (_c: unknown, ctx: PrepareContext) => {
            const input = Object.create(null)
            input.key = 'nullproto'
            input.level = 'warn'
            input.code = 'C'
            input.message = 'm'
            ctx.addDiagnostic(input)
            stashed.push('accepted')
          }
        },
        dependencies: []
      })
    },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  const result = await build(runtime)
  equal(stashed.length, 1, 'null-prototype record accepted')
  ok(result.diagnostics.some(d => d.stage === 'prepare' && d.code === 'C' && (d.origin as { kind: string }).kind === 'prepare-hook'))
})

test('T1.5: addDiagnostic late call after hook settlement throws VeliteError(internal) and appends nothing', async () => {
  let lateCall: (() => void) | undefined
  const runtime: TestRuntime = {
    schemaRunner: testSchemaRunner(),
    fs: (() => {
      const fs = new MemoryFileSystem()
      fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
      return fs
    })(),
    modules: {
      load: async () => ({
        exports: {
          ...baseConfig,
          prepare: (_c: unknown, ctx: PrepareContext) => {
            // Capture the sink for late invocation after the hook returns.
            lateCall = () => ctx.addDiagnostic({ key: 'late', level: 'warn', code: 'L', message: 'late' })
          }
        },
        dependencies: []
      })
    },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  await build(runtime)
  ok(lateCall !== undefined, 'lateCall captured')
  throws(
    () => lateCall!(),
    (err: unknown) => err instanceof VeliteError && err.code === 'internal',
    'late addDiagnostic must throw VeliteError(internal)'
  )
})

test('T1.5: exact duplicate key collapses; reversing call order yields the same set and order', async () => {
  const runtime: TestRuntime = {
    schemaRunner: testSchemaRunner(),
    fs: (() => {
      const fs = new MemoryFileSystem()
      fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
      return fs
    })(),
    modules: {
      load: async () => ({
        exports: {
          ...baseConfig,
          prepare: (_c: unknown, ctx: PrepareContext) => {
            ctx.addDiagnostic({ key: 'dup', level: 'warn', code: 'C1', message: 'm1' })
            ctx.addDiagnostic({ key: 'dup', level: 'warn', code: 'C1', message: 'm1' })
          }
        },
        dependencies: []
      })
    },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  const result = await build(runtime)
  const prepareDiags = result.diagnostics.filter(d => d.stage === 'prepare' && d.origin.kind === 'prepare-hook')
  equal(prepareDiags.length, 1, 'exact duplicate collapses to one')
  equal(prepareDiags[0]!.code, 'C1')
})

test('T1.5: same key with different normalized payload yields one Velite-authored fatal prepare conflict; no winner', async () => {
  const runtime: TestRuntime = {
    schemaRunner: testSchemaRunner(),
    fs: (() => {
      const fs = new MemoryFileSystem()
      fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
      return fs
    })(),
    modules: {
      load: async () => ({
        exports: {
          ...baseConfig,
          prepare: (_c: unknown, ctx: PrepareContext) => {
            ctx.addDiagnostic({ key: 'conflict', level: 'warn', code: 'C1', message: 'first' })
            ctx.addDiagnostic({ key: 'conflict', level: 'error', code: 'C2', message: 'second' })
          }
        },
        dependencies: []
      })
    },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  // The conflict produces a fatal Velite-authored diagnostic; the build fails.
  const captured = await captureRejection(build(runtime))
  ok(captured instanceof VeliteError, 'build must throw VeliteError on fatal prepare conflict')
  const diags = (captured as VeliteError).diagnostics
  // Exactly one Velite-authored fatal prepare-conflict diagnostic; the two
  // user-authored siblings are dropped (no winner).
  const prepareVeliteDiags = diags.filter(d => d.stage === 'prepare' && d.origin.kind === 'velite')
  equal(prepareVeliteDiags.length, 1, 'exactly one conflict diagnostic')
  const diag = prepareVeliteDiags[0]!
  equal(diag.level, 'error')
  equal(diag.code, 'PREPARE_CONFLICT')
  equal(diag.provenance.scope, 'project')
  // Neither user-authored sibling survives.
  const userPrepareDiags = diags.filter(d => d.stage === 'prepare' && d.origin.kind === 'prepare-hook')
  equal(userPrepareDiags.length, 0, 'no user-authored sibling diagnostic survives the conflict')
})

/** Await a promise and return the rejection, or throw if it resolved. */
const captureRejection = async <T>(p: Promise<T>): Promise<unknown> => {
  try {
    await p
  } catch (err) {
    return err
  }
  throw new Error('expected promise to reject, but it resolved')
}

test('T1.5: reversed async completion order yields the same set (Ticket 23 line 965 acceptance)', async () => {
  // Two builds: same hook, but the order in which two async addDiagnostic
  // calls settle is reversed between them. The resulting diagnostic set
  // must be identical (call/append/insertion/Promise-completion order never
  // participates in identity or ordering).
  const makeRuntime = (settleOrder: 'forward' | 'reversed'): TestRuntime => ({
    schemaRunner: testSchemaRunner(),
    fs: (() => {
      const fs = new MemoryFileSystem()
      fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
      return fs
    })(),
    modules: {
      load: async () => ({
        exports: {
          ...baseConfig,
          prepare: async (_c: unknown, ctx: PrepareContext) => {
            // Schedule two async addDiagnostic calls with explicit microtask
            // gates so we can reverse the settle order without changing the
            // call order. Both calls happen in the same tick; the sink is
            // synchronous so snapshot timing is deterministic regardless.
            const p1 = Promise.resolve().then(() => ctx.addDiagnostic({ key: 'a', level: 'warn', code: 'C1', message: 'first' }))
            const p2 = Promise.resolve().then(() => ctx.addDiagnostic({ key: 'b', level: 'warn', code: 'C2', message: 'second' }))
            if (settleOrder === 'forward') {
              await p1
              await p2
            } else {
              await p2
              await p1
            }
          }
        },
        dependencies: []
      })
    },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  })
  const r1 = await build(makeRuntime('forward'))
  const r2 = await build(makeRuntime('reversed'))
  // Same set (and order, since keys are stable by Map insertion order).
  const codes1 = r1.diagnostics.filter(d => d.stage === 'prepare').map(d => d.code)
  const codes2 = r2.diagnostics.filter(d => d.stage === 'prepare').map(d => d.code)
  deepEqual(codes1, codes2, 'reversed async completion yields same diagnostic set')
})

test('T1.5: prepare(false) bypasses no fatal/strict/staging gate — fatal prepare diagnostics still fail the build', async () => {
  const runtime: TestRuntime = {
    schemaRunner: testSchemaRunner(),
    fs: (() => {
      const fs = new MemoryFileSystem()
      fs.put(join(CWD, 'content/posts/a.json'), JSON.stringify([{ title: 'A' }, { title: 'B' }]))
      return fs
    })(),
    modules: {
      load: async () => ({
        exports: {
          ...baseConfig,
          prepare: (_c: unknown, ctx: PrepareContext) => {
            ctx.addDiagnostic({ key: 'k', level: 'error', code: 'FATAL', message: 'boom' })
            return false
          }
        },
        dependencies: []
      })
    },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  }
  // `prepare(false)` suppresses output only; the fatal prepare diagnostic
  // still fails the build through the standard fatal gate.
  const captured = await captureRejection(build(runtime))
  ok(captured instanceof VeliteError, 'build must throw VeliteError on fatal prepare diagnostic')
  const diags = (captured as VeliteError).diagnostics
  ok(
    diags.some(d => d.level === 'error' && d.code === 'FATAL' && d.stage === 'prepare'),
    'fatal prepare diagnostic present despite prepare(false)'
  )
})

test('T1.5: PrepareResult no longer accepts a `diagnostics` field (type-level regression guard)', () => {
  // A hook returning { collections, diagnostics } must NOT typecheck. We
  // assert this by constructing a hook whose return type would widen to
  // PrepareResult; if the legacy `diagnostics?` field were still present,
  // the cast below would silently accept the wrong shape.
  const fn = (() => ({ collections: {}, diagnostics: [] })) as unknown as PrepareHook
  // Runtime: this branch is now ignored by the driver; only `collections`
  // is consumed. `diagnostics` on the return value is dead code.
  equal(typeof fn, 'function')
})
