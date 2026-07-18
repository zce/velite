// SchemaContextHost — the one process-owned ambient exception.
//
// Authority: Ticket 21 (Define schema run storage ownership). The default Node
// runtime composition owns exactly one process-wide `SchemaContextHost` that
// propagates the current `SchemaRunContext` across sync and async execution and
// rejects missing or inactive leased carriers. It owns NO Builder, epoch,
// broker, generation, reader, publication, cache, registry, or lifecycle state.
//
// The module-level installation slot is controlled process ownership: it stores
// one immutable-after-install host identity so the parameterless public
// `context()` accessor and the private content accessor necessarily read the
// same carrier. It offers no token lookup, dynamic registration, capability
// collection, or service discovery. Installing the identical host is idempotent;
// installing a different host after the first is a deterministic internal
// configuration failure. There is no reset, replacement, reference-counting, or
// disposal protocol.

import { fail } from '../diagnostic'

import type { SchemaRunContext } from './run'

/**
 * Process-owned host that propagates the current {@link SchemaRunContext} across
 * synchronous and asynchronous execution. The sole ambient architecture
 * exception required by Zod callbacks.
 */
export interface SchemaContextHost {
  /**
   * Run `operation` with `context` as the ambient {@link SchemaRunContext}.
   * Preserves the callback return type — supports both synchronous and
   * asynchronous callback results. Must preserve LIFO nesting, restore the
   * outer carrier after an inner run, and isolate concurrent async chains.
   */
  run<T>(context: SchemaRunContext, operation: () => T): T
  /**
   * Return only an active carrier. A missing or inactive carrier is an internal
   * invariant failure (throws `VeliteError('internal')`).
   */
  get(): SchemaRunContext
}

let installedHost: SchemaContextHost | undefined

/**
 * Install or obtain the module-private default host. Installing the identical
 * host object is idempotent. Installing a different host after the first
 * installation is always a deterministic internal configuration failure, even
 * when no Builder is currently live. There is no reset, replacement,
 * reference-counting, or disposal protocol.
 */
export const installSchemaContextHost = (host: SchemaContextHost): void => {
  if (installedHost === undefined) {
    installedHost = host
    return
  }
  if (installedHost !== host) {
    fail('internal', 'A different SchemaContextHost was installed after the first — process-owned host identity is immutable after install')
  }
}

/**
 * Return the installed host. Throws `VeliteError('internal')` when called
 * before host installation. Internal composition root use only.
 */
export const schemaContextHost = (): SchemaContextHost => {
  if (installedHost === undefined) fail('internal', 'SchemaContextHost is not installed — call builder()/build()/watch() first')
  return installedHost
}
