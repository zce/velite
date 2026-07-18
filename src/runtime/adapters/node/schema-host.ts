import { AsyncLocalStorage } from 'node:async_hooks'

import { fail } from '../../../core/diagnostic'

import type { SchemaContextHost } from '../../../core/schema/host'
import type { SchemaRunContext } from '../../../core/schema/run'

/**
 * Node-backed {@link SchemaContextHost} via `AsyncLocalStorage`. This is the
 * only file in the repo that imports `node:async_hooks` for schema context
 * propagation. The host propagates the current `SchemaRunContext` across sync
 * and async execution and rejects missing or inactive leased carriers.
 *
 * The host owns NO Builder, epoch, broker, generation, reader, publication,
 * cache, registry, or lifecycle state. Its lifetime is the process lifetime;
 * there is no reset, replacement, reference-counting, or disposal protocol.
 */
export const createNodeSchemaContextHost = (): SchemaContextHost => {
  const als = new AsyncLocalStorage<SchemaRunContext>()
  const host: SchemaContextHost = {
    run: (context, operation) => als.run(context, operation),
    get: () => {
      const carrier = als.getStore()
      if (carrier === undefined) fail('internal', 'SchemaContextHost: no active schema run context')
      return carrier
    }
  }
  return host
}
