import { equal, throws } from 'node:assert/strict'
import { setImmediate as checkpoint } from 'node:timers/promises'

import { createNodePromiseObserver } from '../../src/runtime/adapters/node/promise-observer'
import { createNodeSchemaContextHost } from '../../src/runtime/adapters/node/schema-host'

const mode = process.argv[2]
const host = createNodeSchemaContextHost()
const observer = createNodePromiseObserver({ runUnbound: operation => host.run(undefined, operation) })
if (mode === 'species') {
  const failure = new Error('consumer species getter')
  class CustomPromise extends Promise<unknown> {
    static get [Symbol.species](): PromiseConstructor {
      throw failure
    }
  }
  const original = observer.run(() => new CustomPromise(resolve => resolve('original')))
  throws(
    () => original.then(),
    error => error === failure
  )
}
let resume!: () => void
const release = new Promise<void>(resolve => {
  resume = resolve
})
const inside = observer.run(async () => {
  await release
  const abandoned = Promise.reject(new Error('scoped late rejection')).then()
  void abandoned
  return 'inside'
})

if (mode === 'outside-concurrent') {
  void Promise.reject(new Error('ordinary outside rejection'))
} else if (mode === 'outside-derived') {
  void inside.then(() => {
    throw new Error('ordinary outside-derived rejection')
  })
}
resume()
equal(await inside, 'inside')
await checkpoint()
observer.dispose()
observer.dispose()
if (mode === 'disposed') {
  void Promise.reject(new Error('ordinary rejection after observer disposal'))
  await checkpoint()
}
