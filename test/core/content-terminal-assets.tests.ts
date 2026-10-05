import { deepEqual, equal, ok, rejects, throws } from 'node:assert/strict'
import { test } from 'node:test'

import { createBuilder } from '../../src/core/builder'
import { createMarkdownExecution } from '../../src/core/content/execution/markdown'
import { createMdxExecution } from '../../src/core/content/execution/mdx'
import { createContentExecutionsFactory } from '../../src/core/content/execution/record'
import { isVeliteError } from '../../src/core/diagnostic'
import { content } from '../../src/core/schema/content'
import { context } from '../../src/core/schema/context'
import { schemaContextHost } from '../../src/core/schema/host'
import { s } from '../../src/core/schema/s'
import { silentLogger } from '../../src/runtime/adapters/node'
import { MemoryFileSystem } from '../helpers/memory-fs'
import { noopImageProcessor, noopWatch, testSchemaRunner } from '../helpers/runtime'

import type { TestContext } from 'node:test'
import type { MarkdownExecutionDeps } from '../../src/core/content/execution/markdown'
import type { MdxExecutionDeps } from '../../src/core/content/execution/mdx'
import type { OwnedContent } from '../../src/core/content/execution/types'
import type { RecordContentCapability } from '../../src/core/schema/capability'
import type { SchemaContext } from '../../src/core/schema/context'
import type { SchemaRunInput } from '../../src/core/schema/runner'

const barrier = () => {
  let resolve!: () => void
  const promise = new Promise<void>(done => {
    resolve = done
  })
  return { promise, resolve }
}

const internal = (error: unknown): boolean => isVeliteError(error) && error.code === 'internal'

const terminalAssets = (t: TestContext, dialect: 'markdown' | 'mdx', timing: 'before-read' | 'during-read') => {
  const entered = barrier(),
    release = barrier(),
    finished = barrier()
  t.after(() => release.resolve())
  const runner = testSchemaRunner(),
    host = schemaContextHost(),
    fs = new MemoryFileSystem()
  const assetPath = '/proj/content/asset.png'
  const sourcePath = `/proj/content/post.${dialect === 'markdown' ? 'md' : 'mdx'}`
  fs.put(sourcePath, '# Source\n\n[Download](./asset.png)')
  fs.put(assetPath, 'managed linked file bytes')
  const siblingFailure = new Error('original asynchronous sibling failure')
  const state = {
    reads: 0,
    readSettlements: 0,
    probes: 0,
    blurCalls: 0,
    assetDemands: 0,
    assetSettlements: 0,
    contentDemands: 0,
    declarations: 0,
    rewrites: 0,
    rewriteSuccesses: 0,
    parses: 0,
    transforms: 0,
    emits: 0,
    rewriteError: undefined as unknown,
    transformError: undefined as unknown
  }
  const writes: string[] = []
  const rawRequests: Promise<unknown>[] = [],
    selections: Promise<unknown>[] = []
  let rawContent: SchemaRunInput['contentOperation'] | undefined,
    request: Parameters<SchemaRunInput['contentOperation']>[0] | undefined,
    rawDeclaration: SchemaContext['collectEffect'] | undefined,
    capturedDeclaration: SchemaContext['collectEffect'] | undefined,
    capturedContent: RecordContentCapability | undefined,
    lateSelection: Promise<unknown> | undefined
  const read = fs.read.bind(fs),
    write = fs.write.bind(fs)
  fs.read = async path => {
    if (path !== assetPath) return read(path)
    state.reads++
    if (timing === 'during-read') {
      entered.resolve()
      await release.promise
    }
    const bytes = await read(path)
    state.readSettlements++
    return bytes
  }
  fs.write = async (path, bytes) => {
    writes.push(path)
    await write(path, bytes)
  }
  const options = {
    remarkPlugins: [
      () => {
        capturedDeclaration = context().collectEffect
        capturedContent = host.get().content
        // A real schema-originating descendant keeps its original rejection
        // after abandonment; no test handler turns it into a successful value.
        lateSelection = release.promise.then(() => selected.catch('not allowed').parseAsync('# Late input'))
        return async () => {
          if (timing === 'before-read') {
            entered.resolve()
            await release.promise
          }
        }
      }
    ]
  }
  const selected = dialect === 'markdown' ? content.markdown(options).html() : content.mdx({ ...options, minify: false }).code()
  const schema = s
    .object({
      nested: s
        .object({
          generated: s.any().transform(value => {
            const pending = selected.catch('not allowed').parseAsync(value)
            selections.push(pending)
            return pending
          })
        })
        .prefault({ generated: undefined }),
      stop: s
        .string()
        .optional()
        .transform<string>(async () => {
          await entered.promise
          throw siblingFailure
        })
        .catch('not allowed')
    })
    .catch({ nested: { generated: 'not allowed' }, stop: 'not allowed' })
  const observe = <D extends MarkdownExecutionDeps | MdxExecutionDeps>(create: (deps: D) => OwnedContent, deps: D): OwnedContent => {
    const owned = create({
      ...deps,
      async processAsset(url) {
        state.rewrites++
        try {
          const result = await deps.processAsset!(url)
          state.rewriteSuccesses++
          return result
        } catch (error) {
          state.rewriteError = error
          throw error
        }
      }
    })
    return {
      ...owned,
      parse() {
        state.parses++
        return owned.parse()
      },
      async transform() {
        state.transforms++
        try {
          await owned.transform()
        } catch (error) {
          state.transformError = error
          throw error
        } finally {
          // The complete real run, including built-in linked-file rewriting,
          // has settled. A terminal raw-demand rejection alone cannot prove this.
          finished.resolve()
        }
      },
      emit() {
        state.emits++
        return owned.emit()
      }
    }
  }
  const factory = createContentExecutionsFactory({
    host,
    markdown: deps => observe(createMarkdownExecution, deps),
    mdx: deps => observe(createMdxExecution, deps)
  })
  const instance = createBuilder({
    cwd: '/proj',
    configPath: '/proj/velite.config.ts',
    fs,
    modules: {
      load: async () => ({
        exports: { output: { name: '[name].[ext]' }, collections: { posts: { pattern: 'post.*', schema } } },
        dependencies: []
      })
    },
    schemaRunner: {
      run(input, operation) {
        rawContent = input.contentOperation
        rawDeclaration = input.collectEffect
        // Delegate the original Zod operation unchanged to the installed real
        // runner/Node observer. The sibling schema, not this wrapper, closes it.
        return runner.run(
          {
            ...input,
            async asset(key, request) {
              state.assetDemands++
              const result = await input.asset(key, request)
              state.assetSettlements++
              return result
            },
            contentOperation(value) {
              state.contentDemands++
              request = value
              const pending = input.contentOperation(value)
              rawRequests.push(pending)
              return pending
            }
          },
          operation
        )
      }
    },
    contentExecutionsFactory: {
      open(scope) {
        // Observe accepted batches without replacing any lifecycle operation.
        return factory.open({
          ...scope,
          collectEffects(declarations) {
            state.declarations += declarations.length
            scope.collectEffects(declarations)
          }
        })
      }
    },
    image: {
      async probe(bytes) {
        state.probes++
        return noopImageProcessor.probe(bytes)
      },
      async blurDataURL(...args) {
        state.blurCalls++
        return noopImageProcessor.blurDataURL(...args)
      }
    },
    logger: silentLogger,
    watch: noopWatch
  })
  t.after(() => instance.dispose())
  return {
    instance,
    fs,
    state,
    writes,
    release,
    finished,
    siblingFailure,
    rawRequests,
    selections,
    captured: () => ({ rawContent, request, rawDeclaration, capturedDeclaration, capturedContent, lateSelection })
  }
}

const assertClosed = async (fixture: ReturnType<typeof terminalAssets>) => {
  const { rawContent, request, rawDeclaration, capturedDeclaration, capturedContent } = fixture.captured()
  ok(rawContent && request && rawDeclaration && capturedDeclaration && capturedContent)
  equal(fixture.rawRequests.length, 1)
  equal(fixture.selections.length, 1)
  // These settle before the plugin/read barrier is released: close must not
  // drain pending work, and native catch must not mask the original internal fault.
  await rejects(fixture.rawRequests[0]!, internal)
  await rejects(fixture.selections[0]!, internal)
  await rejects(rawContent(request), internal)
  await rejects(rawContent({ ...request, text: '# New closed demand' }), internal)
  throws(() => capturedContent.content(request), internal)
  for (const declare of [rawDeclaration, capturedDeclaration])
    throws(() => declare({ type: 'unique', group: 'late', value: 'late' }, { path: [], declaration: 0, occurrence: { kind: 'singleton' } }), internal)
}

const assertNoPublication = async (fixture: ReturnType<typeof terminalAssets>) => {
  deepEqual([fixture.state.probes, fixture.state.blurCalls, fixture.state.declarations, fixture.state.emits], [0, 0, 0, 0])
  equal(fixture.state.contentDemands, 1)
  deepEqual([fixture.state.parses, fixture.state.transforms], [1, 1])
  deepEqual(fixture.writes, [])
  deepEqual(await fixture.fs.walk('/proj/public/static'), [])
  deepEqual(await fixture.fs.walk('/proj/.velite'), [])
}

test('content: real sibling failure fences managed asset work after terminal close', { timeout: 10000 }, async t => {
  for (const dialect of ['markdown', 'mdx'] as const)
    await t.test(dialect, async t => {
      const fixture = terminalAssets(t, dialect, 'before-read')
      await rejects(fixture.instance.build(), error => error === fixture.siblingFailure)
      deepEqual([fixture.state.reads, fixture.state.assetDemands], [0, 0])
      await assertClosed(fixture)
      fixture.release.resolve()
      await fixture.finished.promise
      await rejects(fixture.captured().lateSelection!, internal)
      equal(fixture.state.rewrites, 1, 'the real built-in rewriter attempted the linked file after release')
      ok(internal(fixture.state.rewriteError))
      ok(internal(fixture.state.transformError))
      equal(fixture.state.rewriteSuccesses, 0)
      await assertNoPublication(fixture)
      deepEqual(
        [fixture.state.reads, fixture.state.readSettlements, fixture.state.assetDemands, fixture.state.assetSettlements],
        [0, 0, 0, 0],
        'closed rewriting must refuse before starting any managed asset demand or read'
      )
    })
})

test('content: terminal close does not cancel an already-started read but refuses its post-await declaration', { timeout: 10000 }, async t => {
  for (const dialect of ['markdown', 'mdx'] as const)
    await t.test(dialect, async t => {
      const fixture = terminalAssets(t, dialect, 'during-read')
      await rejects(fixture.instance.build(), error => error === fixture.siblingFailure)
      deepEqual([fixture.state.reads, fixture.state.readSettlements, fixture.state.assetDemands, fixture.state.assetSettlements], [1, 0, 1, 0])
      await assertClosed(fixture)
      fixture.release.resolve()
      await fixture.finished.promise
      await rejects(fixture.captured().lateSelection!, internal)
      deepEqual([fixture.state.reads, fixture.state.readSettlements, fixture.state.assetDemands, fixture.state.assetSettlements], [1, 1, 1, 1])
      equal(fixture.state.rewrites, 1)
      equal(fixture.state.rewriteSuccesses, 0, 'asset resolution must not let a post-await declaration succeed after close')
      ok(internal(fixture.state.rewriteError))
      ok(internal(fixture.state.transformError))
      await assertNoPublication(fixture)
    })
})
