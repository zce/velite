import { z } from 'zod'

import * as builtins from './builtins'

/**
 * Velite's schema namespace. A thin, curated surface over zod so users (and our
 * own builtins) never import zod directly — this isolates the validation library
 * so it can evolve or be swapped without churning user configs.
 *
 * Content builtins (`markdown` / `mdx` / `toc` / `excerpt` / `raw` / `metadata`
 * / `path`) read the current file's body via the schema context (`context()`),
 * which the validate derivation wires via `runWithContext` for each record parse.
 * Asset builtins (`file` / `image`) resolve content-relative references through
 * the engine's asset derivation (M5). Uniqueness builtins (`unique` / `slug`)
 * register `UniqueEffect`s the pipeline's `uniqueCheck` derivation scans (M6).
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
  isodate: builtins.isodate,
  markdown: builtins.markdown,
  mdx: builtins.mdx,
  toc: builtins.toc,
  excerpt: builtins.excerpt,
  raw: builtins.raw,
  metadata: builtins.metadata,
  path: builtins.path,
  file: builtins.file,
  image: builtins.image,
  unique: builtins.unique,
  slug: builtins.slug
}

export type SchemaNamespace = typeof s

/** Any schema usable as a collection's per-entry validator. */
export type Schema<T = unknown> = z.ZodType<T>

/** Infer the output type of a schema. */
export type Infer<S extends Schema> = z.infer<S>
