import { AsyncLocalStorage } from 'node:async_hooks'

import { fail } from '../../../core/diagnostic'

import type { SchemaContextHost } from '../../../core/schema/host'
import type { SchemaRunContext } from '../../../core/schema/run'

/**
 * Node-backed {@link SchemaContextHost} via `AsyncLocalStorage`. Propagates the
 * current carrier across sync/async execution; public accessors check its lease.
 * Undefined nested scopes mask the carrier without resetting the host.
 *
 * The host owns NO Builder, epoch, broker, generation, reader, publication,
 * cache, registry, or lifecycle state. Its lifetime is the process lifetime;
 * there is no reset, replacement, reference-counting, or disposal protocol.
 */
export const createNodeSchemaContextHost = (): SchemaContextHost => {
  const als = new AsyncLocalStorage<SchemaRunContext | undefined>()
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
