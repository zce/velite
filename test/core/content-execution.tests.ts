import { deepEqual, equal, ok, rejects, throws } from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'

import { s } from '../../src/core'
import { createBuilder } from '../../src/core/builder'
import { isVeliteError, VeliteError } from '../../src/core/diagnostic'
import { content } from '../../src/core/schema/content'
import { context } from '../../src/core/schema/context'
import { silentLogger } from '../../src/runtime/adapters/node'
import { MemoryFileSystem } from '../helpers/memory-fs'
import { noopImageProcessor, noopWatch, testContentExecutionsFactory, testSchemaRunner } from '../helpers/runtime'

import type { TestContext } from 'node:test'
import type { SchemaRunInput, SchemaRunner } from '../../src/core/schema/runner'
import type { Schema } from '../../src/core/schema/s'

const memoryContent = (t: TestContext, schema: Schema, runner: SchemaRunner = testSchemaRunner()) => {
  const fs = new MemoryFileSystem()
  fs.put('/proj/content/post.md', '# Source')
  const instance = createBuilder({
    cwd: '/proj',
    configPath: '/proj/velite.config.ts',
    fs,
    modules: { load: async () => ({ exports: { collections: { posts: { pattern: '*.md', schema } } }, dependencies: [] }) },
    schemaRunner: runner,
    contentExecutionsFactory: testContentExecutionsFactory(),
    image: noopImageProcessor,
    logger: silentLogger,
    watch: noopWatch
  })
  t.after(() => instance.dispose())
  return { instance, fs }
}

test('content: direct pending higher-stage recursion rejects instead of awaiting itself', { timeout: 5000 }, async t => {
  const doc = content.markdown({
    remarkPlugins: [
      () => async () => {
        await doc.html().catch('not allowed').parseAsync(undefined)
      }
    ]
  })
  const { instance } = memoryContent(t, s.object({ html: doc.html().catch('not allowed') }))
  await rejects(instance.build(), error => isVeliteError(error) && error.code === 'internal' && /Recursive/.test(error.message))
})

test('content: an early synchronous Zod sibling fault leaves no unhandled abandoned content chain', () => {
  execFileSync(process.execPath, ['--unhandled-rejections=strict', '--import', 'jiti/register', 'test/fixtures/content-abandonment.ts'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  })
})

test('content: native nested Zod aggregates abandoned by a synchronous sibling fault remain safely observed', () => {
  execFileSync(process.execPath, ['--unhandled-rejections=strict', '--import', 'jiti/register', 'test/fixtures/content-abandonment.ts', 'nested'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  })
})

const barrier = () => {
  let resolve!: () => void
  const promise = new Promise<void>(done => {
    resolve = done
  })
  return { promise, resolve }
}

test('content: ancestor recursion rejects across executions and completed lower selections remain legal', { timeout: 5000 }, async t => {
  const a = content.markdown({
    remarkPlugins: [
      () => async () => {
        await b.html().parseAsync(undefined)
      }
    ]
  })
  const b = content.markdown({
    remarkPlugins: [
      () => async () => {
        await a.toc().parseAsync(undefined)
      }
    ]
  })
  const { instance } = memoryContent(t, s.object({ html: a.html().catch('not allowed') }))
  await rejects(instance.build(), error => isVeliteError(error) && error.code === 'internal' && /Recursive/.test(error.message))
  const normal = content.markdown({
    remarkPlugins: [
      () => async () => {
        equal(await normal.excerpt().parseAsync(undefined), 'Source')
      }
    ]
  })
  const other = memoryContent(t, s.object({ html: normal.html(), toc: normal.toc() }))
  deepEqual((await other.instance.build()).diagnostics, [])
})

test('content: independent overlapping waiters share work under a controlled barrier', async t => {
  const entered = barrier(),
    release = barrier()
  let parses = 0,
    runs = 0,
    emits = 0
  const doc = content.markdown({
    remarkPlugins: [
      function () {
        const parse = this.parser!
        this.parser = (...args) => {
          parses++
          return parse(...args)
        }
        return async () => {
          runs++
          entered.resolve()
          await release.promise
        }
      }
    ],
    rehypePlugins: [
      function () {
        const processor = this
        return () => {
          const emit = processor.compiler!
          processor.compiler = (...args) => {
            emits++
            return emit(...args)
          }
        }
      }
    ]
  })
  const { instance } = memoryContent(t, s.object({ a: doc.html(), b: doc.html(), toc: doc.toc(), text: doc.excerpt() }))
  const pending = instance.build()
  await entered.promise
  deepEqual([parses, runs, emits], [1, 1, 0])
  release.resolve()
  const result = await pending
  deepEqual(result.diagnostics, [])
  deepEqual([parses, runs, emits], [1, 1, 1])
})

test('content: independently started executions reject mutual pending waits rather than deadlock', { timeout: 5000 }, async t => {
  const aEntered = barrier(),
    bEntered = barrier()
  const a = content.markdown({
    remarkPlugins: [
      () => async () => {
        aEntered.resolve()
        await bEntered.promise
        await b.html().parseAsync(undefined)
      }
    ]
  })
  const b = content.markdown({
    remarkPlugins: [
      () => async () => {
        bEntered.resolve()
        await aEntered.promise
        await a.html().parseAsync(undefined)
      }
    ]
  })
  const { instance } = memoryContent(t, s.object({ a: a.html(), b: b.html() }))
  await rejects(instance.build(), error => isVeliteError(error) && error.code === 'internal' && /Recursive/.test(error.message))
})

test('content: pending Transform/Emit settlement cannot reopen a closed record', async t => {
  for (const phase of ['transform', 'emit'])
    for (const rejectLate of [false, true])
      await t.test(phase + ' ' + rejectLate, async t => {
        const entered = barrier(),
          release = barrier(),
          fault = new VeliteError('internal', { message: 'forced record finalization' })
        const requests: Promise<unknown>[] = []
        let raw: SchemaRunInput['contentOperation'] | undefined,
          request: Parameters<SchemaRunInput['contentOperation']>[0] | undefined,
          collector: SchemaRunInput['collectEffect'] | undefined,
          emits = 0
        const doc = content.mdx({
          remarkPlugins: [
            () => async () => {
              if (phase === 'transform') {
                entered.resolve()
                await release.promise
                if (rejectLate) throw new Error('late plugin rejection')
              }
            }
          ],
          recmaPlugins: [
            function () {
              const processor = this
              return () => {
                const emit = processor.compiler!
                processor.compiler = (...args) => {
                  emits++
                  entered.resolve()
                  return rejectLate ? 'return (' : emit(...args)
                }
              }
            }
          ]
        })
        const runner = testSchemaRunner()
        const { instance, fs } = memoryContent(t, s.object({ code: doc.code().catch('not allowed') }), {
          run(input, operation) {
            raw = input.contentOperation
            collector = input.collectEffect
            return runner.run(
              {
                ...input,
                contentOperation(value) {
                  request = value
                  const pending = input.contentOperation(value)
                  requests.push(pending)
                  void pending.catch(() => {})
                  return pending
                }
              },
              async () => {
                const pending = Promise.resolve(operation())
                void pending.catch(() => {})
                await entered.promise
                throw fault
              }
            )
          }
        })
        await rejects(instance.build(), error => error === fault)
        release.resolve()
        for (const pending of requests) await rejects(pending, error => isVeliteError(error) && error.code === 'internal')
        ok(raw && request && collector)
        await rejects(raw(request), error => isVeliteError(error) && error.code === 'internal')
        throws(
          () => collector!({ type: 'unique', group: 'late', value: 'late' }, { path: [], declaration: 0, occurrence: { kind: 'singleton' } }),
          error => isVeliteError(error) && error.code === 'internal'
        )
        equal(emits, phase === 'emit' ? 1 : 0)
        deepEqual(await fs.walk('/proj/public/static'), [])
        await instance.dispose()
        await instance.dispose()
      })
})

test('content: Parse-origin async capabilities reject after that stage closes even while the record is live', async t => {
  const release = barrier()
  let lateEffect: Promise<unknown> | undefined, lateContent: Promise<unknown> | undefined
  const doc = content.markdown({
    remarkPlugins: [
      () => {
        const collect = context().collectEffect
        lateEffect = release.promise.then(() =>
          collect({ type: 'unique', group: 'late', value: 'late' }, { path: [], declaration: 0, occurrence: { kind: 'singleton' } })
        )
        lateContent = release.promise.then(() => doc.excerpt().catch('not allowed').parseAsync(undefined))
        return () => {}
      }
    ]
  })
  const schema = s.object({ html: doc.html() }).transform(async value => {
    release.resolve()
    await rejects(lateEffect!, error => isVeliteError(error) && error.code === 'internal')
    await rejects(lateContent!, error => isVeliteError(error) && error.code === 'internal')
    return value
  })
  const { instance } = memoryContent(t, schema)
  deepEqual((await instance.build()).diagnostics, [])
})

test('content: terminal record close rejects pending raw requests before a blocked plugin is released', { timeout: 5000 }, async t => {
  const entered = barrier(),
    release = barrier()
  t.after(() => release.resolve())
  const fault = new VeliteError('internal', { message: 'forced close while plugin waits' })
  const doc = content.markdown({
    remarkPlugins: [
      () => async () => {
        entered.resolve()
        await release.promise
      }
    ]
  })
  const runner = testSchemaRunner()
  let raw: Promise<unknown> | undefined
  const { instance } = memoryContent(t, s.object({ html: doc.html() }), {
    run(input, operation) {
      return runner.run(
        {
          ...input,
          contentOperation(request) {
            raw = input.contentOperation(request)
            void raw.catch(() => {})
            return raw
          }
        },
        async () => {
          const pending = Promise.resolve(operation())
          void pending.catch(() => {})
          await entered.promise
          throw fault
        }
      )
    }
  })
  await rejects(instance.build(), error => error === fault)
  ok(raw)
  await rejects(raw, error => isVeliteError(error) && error.code === 'internal')
  release.resolve()
})

test('content: records, independent builds, revalidation and configuration reload own fresh processors', async t => {
  let parses = 0
  const doc = content.markdown({
    remarkPlugins: [
      function () {
        const parse = this.parser!
        this.parser = (...args) => {
          parses++
          return parse(...args)
        }
      }
    ]
  })
  const schema = s.object({ html: doc.html() })
  const a = memoryContent(t, schema),
    b = memoryContent(t, schema)
  a.fs.put('/proj/content/other.md', '# Source')
  await a.instance.build()
  equal(parses, 2)
  await a.instance.build()
  equal(parses, 2, 'unchanged outer validation memo remains valid')
  await b.instance.build()
  equal(parses, 3)
  a.fs.put('/proj/content/post.md', '# Changed')
  await a.instance.apply([{ type: 'change', absPath: '/proj/content/post.md' }])
  equal(parses, 4)
  await a.instance.apply([{ type: 'change', absPath: '/proj/velite.config.ts' }])
  equal(parses, 6)
})

test('content: record finalization closes the actual raw semantic demand boundary', async t => {
  const fs = new MemoryFileSystem()
  fs.put('/proj/content/post.md', '# Source')
  const runner = testSchemaRunner()
  let operation: SchemaRunInput['contentOperation'] | undefined
  let request: Parameters<SchemaRunInput['contentOperation']>[0] | undefined
  const instance = createBuilder({
    cwd: '/proj',
    configPath: '/proj/velite.config.ts',
    fs,
    modules: {
      load: async () => ({
        exports: { collections: { posts: { pattern: '*.md', schema: s.object({ text: content.markdown().excerpt() }) } } },
        dependencies: []
      })
    },
    schemaRunner: {
      run(input, run) {
        operation = input.contentOperation
        return runner.run(
          {
            ...input,
            contentOperation: value => {
              request = value
              return input.contentOperation(value)
            }
          },
          run
        )
      }
    },
    contentExecutionsFactory: testContentExecutionsFactory(),
    image: noopImageProcessor,
    logger: silentLogger,
    watch: noopWatch
  })
  t.after(() => instance.dispose())
  const result = await instance.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, { text: 'Source' })
  ok(operation !== undefined && request !== undefined)
  await rejects(operation(request), error => isVeliteError(error) && error.code === 'internal')
})
