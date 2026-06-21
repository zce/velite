import { z } from 'zod'

import * as builtins from './builtins'

/**
 * Velite's schema namespace. A thin, curated surface over zod so users (and our
 * own builtins) never import zod directly — this isolates the validation library
 * so it can evolve or be swapped without churning user configs.
 *
 * M2a ships only the `isodate` builtin; richer builtins (markdown/mdx/toc/...)
 * arrive in later milestones.
 */
export const s = {
  string: z.string,
  number: z.number,
  boolean: z.boolean,
  date: z.date,
  literal: z.literal,
  enum: z.enum,
  object: z.object,
  array: z.array,
  union: z.union,
  record: z.record,
  unknown: z.unknown,
  any: z.any,
  isodate: builtins.isodate
}

export type SchemaNamespace = typeof s

/** Any schema usable as a collection's per-entry validator. */
export type Schema<T = unknown> = z.ZodType<T>

/** Infer the output type of a schema. */
export type Infer<S extends Schema> = z.infer<S>
