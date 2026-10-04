import type { SemanticContentRequest } from '../content/execution/types'

/** Finite semantic requests; no raw artifacts, plugin recipes or cache controls. */
export type ContentRequest = SemanticContentRequest

/** Private record-bound operation, leased by the existing SchemaRunner. */
export interface RecordContentCapability {
  content(request: ContentRequest): Promise<unknown>
}
