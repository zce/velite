/** Detached navigation through transformed build-time content, in document order. */
export interface TocItem {
  depth: number
  title: string
  id: string
}

/** Pre-transform source metadata; weighted wordCount is not rounded. */
export interface Metadata {
  readingTime: number
  wordCount: number
}

/** Selection-specific formatting; processing belongs to the definition. */
export interface ExcerptSchemaOptions {
  /** Maximum Unicode code points, excluding the ellipsis. @default 260 */
  length?: number
}
