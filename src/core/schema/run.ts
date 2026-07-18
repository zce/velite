// SchemaRunContext — the carrier propagated by the process-owned
// SchemaContextHost. Contains the distinct public `SchemaContext` view, the
// leased private record-bound content capability, and the private lease.
//
// Authority: Ticket 21 (Define schema run storage ownership) + Ticket 19
// (Resolve the internal content capability seam). The exported `context()`
// returns only the eight-field public view; Velite-owned roots use the private
// `content(request)` capability. The public view and private carrier remain
// different runtime objects.
//
// These are internal implementation types. They MUST NOT be exported from the
// schema barrel, core barrel, root package, or package export map, and must
// not appear in built public declarations or runtime reflection.

import type { RecordContentCapability } from './capability'
import type { SchemaContext } from './context'

/**
 * The carrier propagated across async execution by the host. Contains the
 * distinct public view, the leased private content capability, and the lease.
 */
export interface SchemaRunContext {
  /** The eight-field public view returned by `context()`. */
  readonly publicContext: SchemaContext
  /** The narrow leased record-bound content capability. */
  readonly content: RecordContentCapability
  /** The active lease; `false` after run settlement rejects late callers. */
  readonly lease: { active: boolean }
}
