// Builtin schema barrel. Each builtin lives in its own file; this module
// re-exports them so `s.ts` can spread `...builtins` onto the zod namespace.
//
// Content Definitions are separate from this ordinary Zod namespace.

export { file } from './file'
export type { FileSchemaOptions } from './file'
export { image } from './image'
export type { ImageData, ImageSchemaOptions } from './image'
export { isoDate } from './iso-date'
export { path } from './path-schema'
export type { PathSchemaOptions } from './path-schema'
export { raw } from './raw'
export { slug, unique } from './unique'
