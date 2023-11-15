/**
 * @file shared types
 */

import type { VFile } from 'vfile'
import type { ZodType } from 'zod'

/**
 * Single date
 */
export type Entry = Record<string, any>

/**
 * List of data
 */
export type Entries = Entry[]

/**
 * Data from document
 */
export type Collection = Entry | Entries

/**
 * All data, key is collection name
 */
export type Collections = Record<string, Collection>

declare module 'vfile' {
  interface DataMap {
    result: Collection
  }
}

/**
 * File loader
 */
export interface Loader {
  name: string
  test: RegExp
  load: (vfile: VFile, config: Config) => Promise<void>
}

// PluggableList

/**
 * Schema
 */
interface Schema {
  /**
   * Schema name
   */
  name: string
  /**
   * Schema pattern, glob pattern, based on `root`
   */
  pattern: string
  /**
   * Whether the schema is single
   * @default false
   */
  single?: boolean
  /**
   * Schema fields
   */
  fields: ZodType
}

interface MarkdownOptions {
  remarkPlugins?: any[]
  rehypePlugins?: any[]
}

/**
 * User config
 */
export interface Config<Schemas extends Record<string, Schema> = Record<string, Schema>> {
  /**
   * The root directory of the contents
   * @default 'content'
   */
  root: string
  /**
   * The output directory of the data
   * @default '.velite'
   */
  output: string
  /**
   * The content schemas
   */
  schemas: Schemas
  /**
   * File loaders
   * @default [yaml, markdown, json]
   */
  loaders?: Loader[]
  markdown?: MarkdownOptions
  /**
   * Success callback, you can do anything you want with the collections, such as modify them, or write them to files
   */
  callback: (collections: {
    [name in keyof Schemas]: Schemas[name]['single'] extends true ? Schemas[name]['fields']['_output'] : Array<Schemas[name]['fields']['_output']>
  }) => void | Promise<void>
}

// export for user config type inference
export const defineLoader = (loader: Loader) => loader
export const defineConfig = <Schemas extends Record<string, Schema>>(config: Config<Schemas>) => config
