import { deepEqual, equal, match, rejects, strictEqual, throws } from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { setImmediate as checkpoint } from 'node:timers/promises'

import { VeliteError } from '../../../../src/core/diagnostic'
import { createNodePromiseObserver } from '../../../../src/runtime/adapters/node/promise-observer'
import { createNodeSchemaContextHost } from '../../../../src/runtime/adapters/node/schema-host'

import type { SchemaRunContext } from '../../../../src/core/schema/run'

const createObserver = () => {
  const host = createNodeSchemaContextHost()
  return createNodePromiseObserver({ runUnbound: operation => host.run(undefined, operation) })
}

test('node Promise observer bookkeeping does not inherit the schema carrier or disturb actual callback context', async t => {
  const host = createNodeSchemaContextHost()
  const observer = createNodePromiseObserver({ runUnbound: operation => host.run(undefined, operation) })
  t.after(() => observer.dispose())
  const carrier: SchemaRunContext = {
    publicContext: {} as SchemaRunContext['publicContext'],
    content: { content: async () => undefined },
    lease: { active: true }
  }
  const seen: (SchemaRunContext | undefined)[] = []
  class ObservedPromise extends Promise<string> {
    static get [Symbol.species](): PromiseConstructor {
      return Promise
    }

    override then<A = string, B = never>(
      fulfilled?: ((value: string) => A | PromiseLike<A>) | null,
      rejected?: ((reason: unknown) => B | PromiseLike<B>) | null
    ): Promise<A | B> {
      try {
        seen.push(host.get())
      } catch {
        seen.push(undefined)
      }
      return super.then(fulfilled, rejected)
    }
  }
  host.run(carrier, () => {
    observer.run(() => new ObservedPromise(resolve => resolve('observed value')))
    strictEqual(host.get(), carrier)
  })
  await checkpoint()
  deepEqual(seen, [undefined])
  await host.run(carrier, async () => {
    await Promise.resolve()
    strictEqual(host.get(), carrier)
  })
})

test('node Promise observer preserves callback values, Promise identity, fulfillment, and exact synchronous/asynchronous failures', async t => {
  const observer = createObserver()
  t.after(() => observer.dispose())
  const value = { value: 'native fulfillment' }
  strictEqual(
    observer.run(() => value),
    value
  )
  const failure = new VeliteError('internal', { message: 'exact synchronous failure' })
  throws(
    () =>
      observer.run(() => {
        throw failure
      }),
    error => error === failure
  )
  let original!: Promise<typeof value>
  const returned = observer.run(() => (original = Promise.resolve(value)))
  strictEqual(returned, original)
  strictEqual(returned.constructor, Promise)
  strictEqual(await returned, value)
  const ordinary = new Error('exact asynchronous failure')
  for (const error of [ordinary, failure]) {
    const rejected = observer.run(() => Promise.reject(error))
    await checkpoint()
    await rejects(rejected, actual => actual === error)
  }
})

test('node Promise observer has explicit idempotent disposal and rejects new runs after disposal', () => {
  const observer = createObserver()
  observer.dispose()
  observer.dispose()
  throws(
    () => observer.run(() => 'closed'),
    error => error instanceof VeliteError && error.code === 'internal'
  )
})

test('node Promise observer follows asynchronous descendants but leaves outside work and outside continuations normally unhandled', async t => {
  for (const [mode, status, message] of [
    ['scoped', 0, undefined],
    ['species', 0, undefined],
    ['outside-concurrent', 1, 'ordinary outside rejection'],
    ['outside-derived', 1, 'ordinary outside-derived rejection'],
    ['disposed', 1, 'ordinary rejection after observer disposal']
  ] as const)
    await t.test(mode, () => {
      const child = spawnSync(process.execPath, ['--unhandled-rejections=strict', '--import', 'jiti/register', 'test/fixtures/promise-observer.ts', mode], {
        cwd: process.cwd(),
        encoding: 'utf8'
      })
      equal(child.status, status, child.stderr)
      if (message !== undefined) match(child.stderr, new RegExp(message))
    })
})
