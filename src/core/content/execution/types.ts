import type { MarkdownOptions, MdxOptions } from '../options'
import type { NavigationSnapshot } from './navigation'

export type ContentOptions = MarkdownOptions
export type MdxContentOptions = MdxOptions

export interface ContentDefinitionDescriptor {
  readonly dialect: 'markdown' | 'mdx'
  readonly options: MdxContentOptions
}

export interface SemanticContentRequest {
  readonly definition: ContentDefinitionDescriptor
  readonly text: string
  readonly selection: 'excerpt' | 'metadata' | 'html' | 'code' | 'toc'
  readonly length?: number
}

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
