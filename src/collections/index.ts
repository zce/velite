import type { InferSchema, VeliteSchema } from '../schemas'

/**
 * A content collection: a matching rule, an output shape and a schema.
 */
export interface Collection<TSchema extends VeliteSchema = VeliteSchema> {
  /** Generated TypeScript type name, e.g. `Post`. */
  typeName: string
  /** Glob pattern(s) relative to the content root, supporting `!negation`. */
  pattern: string | string[]
  /** Whether the collection result is a single record instead of an array. */
  single?: boolean
  /** Schema validating and transforming each record. */
  schema: TSchema
}

/** All collections keyed by their data export name. */
export interface Collections {
  [collectionKey: string]: Collection
}

/** The result type of a single collection. */
export type CollectionResult<TCollection extends Collection> = TCollection['single'] extends true
  ? InferSchema<TCollection['schema']>
  : Array<InferSchema<TCollection['schema']>>

/** The full build result: each collection key mapped to its result. */
export type BuildResult<TCollections extends Collections = Collections> = {
  [K in keyof TCollections]: CollectionResult<TCollections[K]>
}

/** Define a collection (identity helper for type inference). */
export const defineCollection = <T extends Collection>(collection: T): T => collection
