import * as z from 'zod'

import * as builtins from './builtins'

/**
 * Velite's schema namespace. A thin, curated surface over zod so users (and our
 * own builtins) never import zod directly — this isolates the validation library
 * so it can evolve or be swapped without churning user configs.
 *
 * Uses `...z` to forward all zod base schemas: if zod adds a new primitive in
 * a future minor, it appears here automatically without a velite release.
 * Builtins (`markdown`, `image`, etc.) override or extend the zod surface.
 *
 * Content builtins (`markdown` / `mdx` / `toc` / `excerpt` / `raw` / `metadata`
 * / `path`) read the current file's body via the schema context (`context()`),
 * which the validate derivation wires via `runWithContext` for each record parse.
 * Asset builtins (`file` / `image`) resolve content-relative references through
 * the engine's asset derivation (M5). Uniqueness builtins (`unique` / `slug`)
 * register `UniqueEffect`s the pipeline's `uniqueCheck` derivation scans (M6).
 */
export const s = {
  ...z,
  ...builtins
}

export type SchemaNamespace = typeof s

/** Any schema usable as a collection's per-entry validator. */
export type Schema<T = unknown> = z.ZodType<T>

/** Infer the output type of a schema. */
export type Infer<S extends Schema> = z.infer<S>

/**
 * Identity helper for a custom schema, for type inference and editor support.
 * No runtime effect — constrains the value to a valid {@link Schema}.
 *
 * @example
 * const gitSha = defineSchema(s.string().transform(() => execSync('git rev-parse HEAD').toString()))
 */
export const defineSchema = <S extends Schema>(schema: S): S => schema
