// RecordContentCapability + ContentRequest — the narrow private record-bound
// content capability leased through the SchemaRunContext. Velite-owned roots
// and projections use exactly one controlled `content(request)` operation.
// Custom schemas receive no broker, pristine representation, request
// constructor, generic demand, projection protocol, or private branch state.
//
// Authority: Ticket 21 + Ticket 19. Internal — not exported.

/** A content request descriptor carried by the private capability. Internal. */
export type ContentRequest = {
  readonly kind: string
  readonly text: string
  readonly path: string
  readonly dialect: 'markdown' | 'mdx'
  readonly profile: unknown
  readonly projection?: string
  readonly options?: unknown
}

/** A narrow record-bound content capability. Internal — not exported. */
export interface RecordContentCapability {
  /**
   * Demand a content derivation for the current record. The carried operation
   * checks the same lease on every invocation before delegating to the record
   * broker. Throws `VeliteError('internal')` after lease closure.
   */
  content(request: ContentRequest): Promise<unknown>
}
