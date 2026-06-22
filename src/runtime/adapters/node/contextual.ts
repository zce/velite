import { AsyncLocalStorage } from 'node:async_hooks'

import type { ContextStorage } from '../../contextual'

/**
 * Node-backed {@link ContextStorage} via `AsyncLocalStorage`. This is the only
 * file in the repo that imports `node:async_hooks` — it stays in the runtime
 * adapter layer so the pure core never touches a Node builtin.
 */
const als = new AsyncLocalStorage<unknown>()

export const nodeContextStorage: ContextStorage<unknown> = {
  run: (value, fn) => als.run(value, fn),
  get: () => als.getStore()
}
