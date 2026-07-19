// Excerpt projection options shared by the Markdown and MDX root methods.
//
// The top-level `s.excerpt()` form is removed; `.excerpt(options?)` is a method
// on the dialect root. The options surface is exactly `{ length?: number }`.

/** Options for the {@link MarkdownRoot.excerpt} / {@link MdxRoot.excerpt} projection method. */
export interface ExcerptSchemaOptions {
  /** Excerpt length. @default 260 */
  length?: number
}
