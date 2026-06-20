import type { VeliteSchema } from '../schemas'

/**
 * Collection options
 */
export interface Collection {
  /**
   * Collection name (singular), for types generation
   * @example
   * 'Post'
   */
  name: string
  /**
   * Collection glob pattern, based on `root`
   * @example
   * 'posts/*.md'
   * ['posts/*.md', '!posts/index.md']
   */
  pattern: string | string[]
  /**
   * Whether the schema is single
   * @default false
   */
  single?: boolean
  /**
   * Collection schema
   * @see {@link https://zod.dev}
   * @example
   * s.object({
   *   title: s.string(), // from frontmatter
   *   description: s.string().optional(), // from frontmatter
   *   excerpt: s.string() // from markdown body,
   *   content: s.string() // from markdown body
   * })
   */
  schema: VeliteSchema
}

/**
 * All collections
 */
export interface Collections {
  [name: string]: Collection
}

/**
 * Collection Type
 */
export type CollectionType<T extends Collections, P extends keyof T> = T[P]['single'] extends true
  ? T[P]['schema']['_output']
  : Array<T[P]['schema']['_output']>

/**
 * All collections result
 */
export type BuildResult<T extends Collections> = { [P in keyof T]: CollectionType<T, P> }

/**
 * Define a collection (identity function for type inference)
 */
export const defineCollection = <T extends Collection>(collection: T): T => collection
