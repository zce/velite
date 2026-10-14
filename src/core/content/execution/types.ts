import type { MdxOptions } from '../options'
import type { NavigationSnapshot } from './navigation'

export type MdxContentOptions = MdxOptions

export interface ContentDefinitionDescriptor {
  readonly dialect: 'markdown' | 'mdx'
  readonly options: MdxContentOptions
}

/**
 * A record-scoped content demand. The `excerpt` selection requires an explicit
 * `length` — enforced by the type, so the executing record never sees an
 * excerpt request without one.
 */
export type SemanticContentRequest =
  | { readonly definition: ContentDefinitionDescriptor; readonly text: string; readonly selection: 'excerpt'; readonly length: number }
  | { readonly definition: ContentDefinitionDescriptor; readonly text: string; readonly selection: 'metadata' | 'html' | 'code' | 'toc' }

/** Opaque stage metadata propagated by the existing host, never a journal or processor. */
export interface ContentStageScope {
  readonly token: symbol
  readonly execution: symbol
  readonly phase: 'parse' | 'transform' | 'emit'
  readonly parent?: ContentStageScope
}

export interface OwnedContent {
  parse(): void | Promise<void>
  transform(): void | Promise<void>
  emit(): string | Promise<string>
  sourceText(): string
  navigation(): NavigationSnapshot
  messages(): readonly { reason: string; fatal?: boolean | null }[]
  close(): void
}
