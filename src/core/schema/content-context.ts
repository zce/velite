// Private content-context accessor for Velite-owned roots and projections.
//
// The exported `context()` returns only the eight-field public view; Velite-
// owned roots and projections use this unexported internal accessor to obtain
// the leased record-bound `content(request)` capability. The carrier is the
// same one propagated by the process-owned SchemaContextHost; the lease is the
// same one the SchemaRunner activates for each record parse.
//
// Internal — not exported from the schema barrel, core barrel, root package
// entry, or package export map. Custom schemas never reach this accessor.

import { fail } from '../diagnostic'
import { schemaContextHost } from './host'

import type { RecordContentCapability } from './capability'

/**
 * Get the leased private `content(request)` capability for the current record
 * parse. Velite-owned roots and projections only.
 *
 * @throws `VeliteError('internal')` when called outside of a schema parse or
 *   after the active run has settled (late call).
 */
export const contentContext = (): RecordContentCapability => {
  const carrier = schemaContextHost().get()
  if (!carrier.lease.active) fail('internal', 'Schema run lease is inactive — contentContext() called after settlement')
  return carrier.content
}
