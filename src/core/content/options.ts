import type { PluggableList } from 'unified'

/** Global Markdown defaults; definition-local scalars take precedence. */
export interface MarkdownOptions {
  /** Enable GitHub Flavored Markdown. @default true */
  gfm?: boolean
  /** Remove content comments. @default true */
  removeComments?: boolean
  /** Copy local linked assets through Velite's asset flow. @default true */
  copyLinkedFiles?: boolean
  /** Definition-local plugins run before global plugins. */
  remarkPlugins?: PluggableList
  /** Definition-local plugins run before global plugins. */
  rehypePlugins?: PluggableList
}

/** Global MDX defaults, resolved once for each record-local definition. */
export interface MdxOptions extends MarkdownOptions {
  /** Minify serialized JavaScript with Terser. @default true */
  minify?: boolean
  /** @default 'function-body' */
  outputFormat?: 'function-body' | 'program'
  /** @default false */
  development?: boolean
  /** Run as part of complete Transform, including TOC-only demands. */
  recmaPlugins?: PluggableList
}
