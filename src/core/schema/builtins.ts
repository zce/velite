// Builtin schema barrel. Each builtin lives in its own file; this module
// re-exports them so `s.ts` can spread `...builtins` onto the zod namespace.
//
// The Markdown/MDX projection methods (`.toc()` / `.excerpt(options?)` /
// `.metadata()`) live on the dialect roots (`s.markdown()` / `s.mdx()`). The
// top-level `s.toc` / `s.excerpt` / `s.metadata` forms are removed.

export type { ExcerptSchemaOptions } from './excerpt'
export { file } from './file'
export type { FileSchemaOptions } from './file'
export { image } from './image'
export type { ImageData, ImageSchemaOptions } from './image'
export { isoDate } from './iso-date'
export { markdown } from './markdown'
export type { MarkdownRoot, MarkdownSchemaOptions } from './markdown'
export { mdx } from './mdx'
export type { MdxRoot, MdxSchemaOptions } from './mdx'
export type { Metadata } from './metadata'
export { path } from './path-schema'
export type { PathSchemaOptions } from './path-schema'
export { raw } from './raw'
export { slug, unique } from './unique'
