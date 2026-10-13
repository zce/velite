import { deepEqual, equal, ok, rejects } from 'node:assert/strict'
import { test } from 'node:test'

import { resolveConfig } from '../../src/core/config'
import { createMarkdownExecution } from '../../src/core/content/execution/markdown'
import { createMdxExecution } from '../../src/core/content/execution/mdx'
import { createContentExecutionsFactory } from '../../src/core/content/execution/record'
import { isVeliteError, VeliteError } from '../../src/core/diagnostic'
import { createEngine } from '../../src/core/engine'
import { buildProjectInfo, createValidateDerivation } from '../../src/core/pipeline/validate'
import { content } from '../../src/core/schema/content'
import { context, createContentFile, createSessionStore } from '../../src/core/schema/context'
import { schemaContextHost } from '../../src/core/schema/host'
import { s } from '../../src/core/schema/s'
import { MemoryFileSystem } from '../helpers/memory-fs'
import { noopImageProcessor, testSchemaRunner } from '../helpers/runtime'

import type { AssetKey, AssetResult } from '../../src/core/assets'
import type { Derivation } from '../../src/core/engine'
import type { Loaded } from '../../src/core/pipeline/types'
import type { SchemaRunInput } from '../../src/core/schema/runner'

const barrier = () => {
  let resolve!: () => void
  const promise = new Promise<void>(done => {
    resolve = done
  })
  return { promise, resolve }
}

test('content: already-entered Parse success and rejection cannot revive a finalized record', async t => {
  for (const rejectLate of [false, true])
    await t.test(String(rejectLate), async () => {
      const entered = barrier(),
        release = barrier(),
        settled = barrier()
      const runner = testSchemaRunner(),
        fs = new MemoryFileSystem()
      const fault = new VeliteError('internal', { message: 'forced finalization during Parse' })
      let transforms = 0,
        emits = 0,
        promotions = 0,
        parseOutcome = ''
      let lateDeclaration: unknown, raw: SchemaRunInput['contentOperation'] | undefined
      const requests: Promise<unknown>[] = []
      const doc = content.markdown()
      const config = await resolveConfig(
        {
          fs,
          modules: {
            load: async () => ({ exports: { collections: { posts: { pattern: '*.md', schema: s.object({ html: doc.html() }) } } }, dependencies: [] })
          }
        },
        { cwd: '/proj', configPath: '/proj/velite.config.ts' }
      )
      const factory = createContentExecutionsFactory({
        host: schemaContextHost(),
        mdx: createMdxExecution,
        markdown(deps) {
          const owned = createMarkdownExecution(deps)
          return {
            ...owned,
            async parse() {
              await owned.parse()
              const collect = context().collectEffect
              collect({ type: 'unique', group: 'pending-parse', value: 'early' }, { path: [], declaration: 0, occurrence: { kind: 'singleton' } })
              entered.resolve()
              await release.promise
              try {
                collect({ type: 'unique', group: 'pending-parse', value: 'late' }, { path: [], declaration: 1, occurrence: { kind: 'singleton' } })
              } catch (error) {
                lateDeclaration = error
              }
              parseOutcome = rejectLate ? 'rejection' : 'success'
              settled.resolve()
              if (rejectLate) throw new Error('late Parse failure')
            },
            transform() {
              transforms++
              return owned.transform()
            },
            emit() {
              emits++
              return owned.emit()
            }
          }
        }
      })
      const load: Derivation<string, Loaded> = {
        name: 'load',
        compute: () => ({ entries: [{ id: 'post.md#', source: 'post.md', key: '', data: {}, meta: { content: '# Source' } }], diagnostics: [] })
      }
      const asset: Derivation<AssetKey, AssetResult> = {
        name: 'asset',
        compute: () => {
          throw new Error('unexpected asset work')
        }
      }
      const validate = createValidateDerivation(config, load, asset, {
        fs,
        image: noopImageProcessor,
        contentExecutionsFactory: {
          open(scope) {
            return factory.open({
              ...scope,
              collectEffects(declarations) {
                promotions++
                scope.collectEffects(declarations)
              }
            })
          }
        },
        schemaRunner: {
          run(input, operation) {
            raw = input.contentOperation
            return runner.run(
              {
                ...input,
                contentOperation(request) {
                  const pending = input.contentOperation(request)
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
        }
      })
      await rejects(createEngine().get(validate, { collection: 'posts', path: 'post.md' }), error => error === fault)
      release.resolve()
      await settled.promise
      for (const pending of requests) await rejects(pending, error => isVeliteError(error) && error.code === 'internal')
      equal(parseOutcome, rejectLate ? 'rejection' : 'success')
      ok(isVeliteError(lateDeclaration) && lateDeclaration.code === 'internal')
      deepEqual([transforms, emits, promotions], [0, 0, 0])
      ok(raw)
      deepEqual(await fs.walk('/proj/public/static'), [])
    })
})

test('content: completed Parse wait edges do not create a false cycle between pending Transforms', { timeout: 5000 }, async () => {
  const aEntered = barrier(),
    bRelease = barrier()
  const runner = testSchemaRunner(),
    fs = new MemoryFileSystem()
  const a = content.markdown({
    remarkPlugins: [
      () => async () => {
        aEntered.resolve()
        equal(await b.excerpt().parseAsync('# B'), 'B')
      }
    ]
  })
  const b = content.markdown({
    remarkPlugins: [
      () => async () => {
        deepEqual(await a.toc().parseAsync('# A'), [{ depth: 1, title: 'A', id: 'a' }])
      }
    ]
  })
  const schema = s.object({ b: s.preprocess(() => '# B', b.html()), a: s.preprocess(() => '# A', a.toc()) })
  const config = await resolveConfig(
    { fs, modules: { load: async () => ({ exports: { collections: { posts: { pattern: '*.md', schema } } }, dependencies: [] }) } },
    { cwd: '/proj', configPath: '/proj/velite.config.ts' }
  )
  const factory = createContentExecutionsFactory({
    host: schemaContextHost(),
    mdx: createMdxExecution,
    markdown(deps) {
      const owned = createMarkdownExecution(deps)
      if (deps.text !== '# B') return owned
      return {
        ...owned,
        async parse() {
          await owned.parse()
          await bRelease.promise
        }
      }
    }
  })
  const project = buildProjectInfo(config),
    file = createContentFile('post.md', '/proj/content/post.md', '# Source'),
    record = { id: 'post.md#', index: 0 }
  const owner = factory.open({ project, file, record, collection: { order: 0, id: 'posts' }, collectEffects() {} })
  try {
    const result = await runner.run(
      {
        project,
        file,
        record,
        store: createSessionStore(),
        collectEffect: owner.collectEffect,
        contentOperation: owner.demand,
        readFile: path => fs.read(path),
        probeImage: async () => ({ width: 0, height: 0, format: '', blurDataURL: '', blurWidth: 0, blurHeight: 0 }),
        asset: async () => {
          throw new Error('unexpected asset work')
        }
      },
      async () => {
        const pending = schema.safeParseAsync({})
        void pending.catch(() => {})
        await aEntered.promise
        bRelease.resolve()
        return pending
      }
    )
    ok(result.success)
    if (result.success) deepEqual(result.data, { b: '<h1 id="b">B</h1>', a: [{ depth: 1, title: 'A', id: 'a' }] })
  } finally {
    owner.close()
  }
})
