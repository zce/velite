import * as z from 'zod'

import { excerpt } from './excerpt'
import { file } from './file'
import { image } from './image'
import { isoDate } from './isodate'
import { markdown } from './markdown'
import { mdx } from './mdx'
import { metadata } from './metadata'
import { path } from './path'
import { raw } from './raw'
import { slug } from './slug'
import { toc } from './toc'
import { unique } from './unique'

/**
 * `s` is the Velite schema namespace: all of Zod plus Velite's built-in
 * content schemas.
 */
export const s = {
  ...z,
  excerpt,
  file,
  image,
  isoDate,
  markdown,
  mdx,
  metadata,
  path,
  raw,
  slug,
  toc,
  unique
} as const

/** A Velite schema is a Zod type. */
export type VeliteSchema<Output = unknown, Input = unknown> = z.ZodType<Output, Input>

/** Infer the output type of a Velite schema. */
export type InferSchema<TSchema extends VeliteSchema> = z.infer<TSchema>
