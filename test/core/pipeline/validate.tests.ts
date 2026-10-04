import { deepEqual, equal, notStrictEqual, ok, rejects, throws } from 'node:assert/strict'
import { test } from 'node:test'

import { s } from '../../../src/core'
import { createBuilder } from '../../../src/core/builder'
import { isVeliteError, VeliteError } from '../../../src/core/diagnostic'
import { context } from '../../../src/core/schema/context'
import { schemaContextHost } from '../../../src/core/schema/host'
import { silentLogger } from '../../../src/runtime/adapters/node'
import { MemoryFileSystem } from '../../helpers/memory-fs'
import { noopImageProcessor, noopWatch, testContentExecutionsFactory, testSchemaRunner } from '../../helpers/runtime'

import type { TestContext } from 'node:test'
import type { SchemaContext } from '../../../src/core/schema/context'
import type { SchemaRunInput, SchemaRunner } from '../../../src/core/schema/runner'
import type { Schema } from '../../../src/core/schema/s'

const setup = (t: TestContext, schema: Schema, runner: SchemaRunner = testSchemaRunner()) => {
  const fs = new MemoryFileSystem()
  fs.put('/proj/content/posts.json', JSON.stringify([{ attachment: './valid.txt', slug: 'shared' }]))
  fs.put('/proj/content/valid.txt', 'valid record asset')
  const instance = createBuilder({
    cwd: '/proj',
    configPath: '/proj/velite.config.ts',
    fs,
    schemaRunner: runner,
    contentExecutionsFactory: testContentExecutionsFactory(),
    modules: {
      load: async () => ({
        exports: { root: 'content', output: { name: '[name].[ext]' }, collections: { posts: { pattern: 'posts.json', schema } } },
        dependencies: []
      })
    },
    logger: silentLogger,
    image: noopImageProcessor,
    watch: noopWatch
  })
  t.after(() => instance.dispose())
  return { instance, fs }
}

test('record validation: captured raw and eight-field public declarations reject after success without altering assets or unique diagnostics', async t => {
  let captured: SchemaContext['collectEffect'] | undefined
  let rawDeclaration: SchemaContext['collectEffect'] | undefined
  const schema = s.object({ attachment: s.file(), slug: s.unique('records') }).transform(value => {
    const publicContext = context()
    deepEqual(Reflect.ownKeys(publicContext).sort(), ['asset', 'collectEffect', 'file', 'probeImage', 'project', 'readFile', 'record', 'store'])
    notStrictEqual(publicContext, schemaContextHost().get(), 'the public view and leased carrier remain distinct runtime objects')
    captured = publicContext.collectEffect
    return value
  })
  const runner = testSchemaRunner()
  const { instance, fs } = setup(t, schema, {
    run(input, operation) {
      rawDeclaration = input.collectEffect
      return runner.run(input, operation)
    }
  })
  const first = await instance.build({ layout: 'single' })
  deepEqual(first.diagnostics, [])
  ok(captured !== undefined)
  ok(rawDeclaration !== undefined)

  for (const declare of [rawDeclaration, captured]) {
    throws(
      () => declare({ type: 'unique', group: 'records', value: 'late' }, { path: ['slug'], declaration: 0, occurrence: { kind: 'singleton' } }),
      (error: unknown) => isVeliteError(error) && error.code === 'internal'
    )
    throws(
      () =>
        declare(
          { type: 'asset', source: '/proj/content/missing.txt', output: { base: '/static/', template: '[name].[ext]' }, metadata: false },
          { path: ['attachment'], declaration: 0, occurrence: { kind: 'singleton' } }
        ),
      (error: unknown) => isVeliteError(error) && error.code === 'internal'
    )
  }

  const second = await instance.build({ layout: 'single' })
  deepEqual(second.output, first.output)
  deepEqual(second.diagnostics, [])
  deepEqual(await fs.walk('/proj/public/static'), ['/proj/public/static/valid.txt'])
  equal(new TextDecoder().decode(await fs.read('/proj/public/static/valid.txt')), 'valid record asset')
})

test('record validation: a thrown operation discards candidates and closes the raw and public declaration boundaries', async t => {
  const failure = new Error('record operation failed')
  let shouldThrow = true
  let publicDeclaration: SchemaContext['collectEffect'] | undefined
  let rawDeclaration: SchemaContext['collectEffect'] | undefined
  const schema = s
    .object({ attachment: s.file(), slug: s.unique('records') })
    .transform(async value => {
      publicDeclaration = context().collectEffect
      await Promise.resolve()
      if (shouldThrow) throw failure
      return value
    })
    .catch({ attachment: 'fallback', slug: 'fallback' })
  const runner = testSchemaRunner()
  const { instance, fs } = setup(t, schema, {
    run(input, operation) {
      rawDeclaration = input.collectEffect
      return runner.run(input, operation)
    }
  })

  await rejects(instance.build({ layout: 'single' }), error => error === failure, 'native Zod catch must not recover a thrown record operation')
  deepEqual(await fs.walk('/proj/public/static'), [], 'a thrown record cannot publish its successfully resolved asset')
  await rejects(fs.read('/proj/.velite/posts.json'))
  ok(rawDeclaration !== undefined)
  ok(publicDeclaration !== undefined)
  for (const declare of [rawDeclaration, publicDeclaration]) {
    throws(
      () => declare({ type: 'unique', group: 'records', value: 'shared' }, { path: ['slug'], declaration: 0, occurrence: { kind: 'singleton' } }),
      (error: unknown) => isVeliteError(error) && error.code === 'internal'
    )
    throws(
      () =>
        declare(
          { type: 'asset', source: '/proj/content/missing.txt', output: { base: '/static/', template: '[name].[ext]' }, metadata: false },
          { path: ['attachment'], declaration: 0, occurrence: { kind: 'singleton' } }
        ),
      (error: unknown) => isVeliteError(error) && error.code === 'internal'
    )
  }

  shouldThrow = false
  const recovered = await instance.build({ layout: 'single' })
  deepEqual(recovered.diagnostics, [])
  deepEqual(
    recovered.output.collections.posts!.entries.map(entry => entry.data),
    [{ attachment: '/static/valid.txt', slug: 'shared' }]
  )
  deepEqual(await fs.walk('/proj/public/static'), ['/proj/public/static/valid.txt'])
})

test('record validation: an unhandled Zod issue closes captured declarations and discards the invalid record asset', async t => {
  let publicDeclaration: SchemaContext['collectEffect'] | undefined
  let rawDeclaration: SchemaContext['collectEffect'] | undefined
  const schema = s.object({
    attachment: s.file(),
    slug: s.unique('records').transform(value => {
      publicDeclaration = context().collectEffect
      return value
    }),
    title: s.string()
  })
  const runner = testSchemaRunner()
  const { instance, fs } = setup(t, schema, {
    run(input, operation) {
      rawDeclaration = input.collectEffect
      return runner.run(input, operation)
    }
  })

  const result = await instance.build({ layout: 'single' })
  deepEqual(result.output.collections.posts!.entries, [])
  equal(result.diagnostics.length, 1)
  equal(result.diagnostics[0]!.code, 'SCHEMA_INVALID')
  deepEqual(await fs.walk('/proj/public/static'), [])
  ok(rawDeclaration !== undefined)
  ok(publicDeclaration !== undefined)
  for (const declare of [rawDeclaration, publicDeclaration]) {
    throws(
      () => declare({ type: 'unique', group: 'records', value: 'shared' }, { path: ['slug'], declaration: 0, occurrence: { kind: 'singleton' } }),
      (error: unknown) => isVeliteError(error) && error.code === 'internal'
    )
  }

  const repeat = await instance.build({ layout: 'single' })
  deepEqual(repeat.output, result.output)
  deepEqual(repeat.diagnostics, result.diagnostics)
  deepEqual(await fs.walk('/proj/public/static'), [])
})

test('record validation: synchronous invariant throws escape native catch and close the public declaration lease', async t => {
  let captured: SchemaContext['collectEffect'] | undefined
  const failure = new VeliteError('internal', { message: 'synchronous record fault' })
  const schema = s.object({
    attachment: s.file(),
    slug: s
      .unique('records')
      .transform<string>(() => {
        captured = context().collectEffect
        throw failure
      })
      .catch('fallback')
  })
  const { instance, fs } = setup(t, schema)

  await rejects(instance.build({ layout: 'single' }), error => error === failure)
  ok(captured !== undefined)
  throws(
    () => captured!({ type: 'unique', group: 'records', value: 'late' }, { path: ['slug'], declaration: 0, occurrence: { kind: 'singleton' } }),
    (error: unknown) => isVeliteError(error) && error.code === 'internal'
  )
  deepEqual(await fs.walk('/proj/public/static'), [])
  await rejects(fs.read('/proj/.velite/posts.json'))
})

test('record validation: a pending sibling cannot declare after another sibling throws and the record settles', async t => {
  const failure = new Error('another sibling failed')
  let siblingStarted!: () => void
  let resumeSibling!: () => void
  let observeLateDeclaration!: (error: unknown) => void
  const started = new Promise<void>(resolve => (siblingStarted = resolve))
  const resumed = new Promise<void>(resolve => (resumeSibling = resolve))
  const lateDeclaration = new Promise<unknown>(resolve => (observeLateDeclaration = resolve))
  const schema = s.object({
    attachment: s.file(),
    stop: s.string().transform(async () => {
      await started
      throw failure
    }),
    late: s.string().transform(async value => {
      const declare = context().collectEffect
      siblingStarted()
      await resumed
      try {
        declare({ type: 'unique', group: 'records', value: 'shared' }, { path: ['late'], declaration: 0, occurrence: { kind: 'singleton' } })
        observeLateDeclaration(undefined)
        return value
      } catch (error) {
        observeLateDeclaration(error)
        throw error
      }
    })
  })
  const { instance, fs } = setup(t, schema)
  fs.put('/proj/content/posts.json', JSON.stringify([{ attachment: './valid.txt', stop: 'stop', late: 'late' }]))

  await rejects(instance.build({ layout: 'single' }), error => error === failure)
  resumeSibling()
  const lateError = await lateDeclaration
  ok(isVeliteError(lateError) && lateError.code === 'internal', 'the captured capability resolves the already closed record lease')
  deepEqual(await fs.walk('/proj/public/static'), [])
  await rejects(fs.read('/proj/.velite/posts.json'))
})

test('record validation: PromiseLike operations retain ambient context for declarations and close the captured lease', async t => {
  let captured: SchemaContext['collectEffect'] | undefined
  const runner = testSchemaRunner()
  const { instance, fs } = setup(t, s.object({ attachment: s.file(), slug: s.unique('records') }), {
    run<T>(input: SchemaRunInput, operation: () => T | PromiseLike<T>) {
      const thenable: PromiseLike<T> = {
        then(onfulfilled, onrejected) {
          captured = context().collectEffect
          captured({ type: 'unique', group: 'thenable', value: 'retained' }, { path: ['slug'], declaration: 0, occurrence: { kind: 'singleton' } })
          return Promise.resolve(operation()).then(onfulfilled, onrejected)
        }
      }
      return runner.run(input, () => thenable)
    }
  })
  fs.put(
    '/proj/content/posts.json',
    JSON.stringify([
      { attachment: './valid.txt', slug: 'first' },
      { attachment: './valid.txt', slug: 'second' }
    ])
  )

  const result = await instance.build({ layout: 'single' })
  equal(result.output.collections.posts!.entries.length, 0)
  equal(result.diagnostics.length, 2)
  for (const issue of result.diagnostics) equal(issue.message, 'duplicate unique value "retained" in group "thenable"')
  deepEqual(await fs.walk('/proj/public/static'), [], 'cross-record conflicts discard both complete asset contributions')
  ok(captured !== undefined)
  throws(
    () => captured!({ type: 'unique', group: 'thenable', value: 'late' }, { path: ['slug'], declaration: 0, occurrence: { kind: 'singleton' } }),
    (error: unknown) => isVeliteError(error) && error.code === 'internal'
  )
})
