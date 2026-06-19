import * as z from 'zod'

import { excerpt } from './excerpt'
import { file } from './file'
import { image } from './image'
import { isodate } from './isodate'
import { markdown } from './markdown'
import { mdx } from './mdx'
import { metadata } from './metadata'
import { path } from './path'
import { raw } from './raw'
import { slug } from './slug'
import { toc } from './toc'
import { unique } from './unique'

export const s = {
  ...z,
  excerpt,
  file,
  image,
  isodate,
  markdown,
  mdx,
  metadata,
  path,
  raw,
  slug,
  toc,
  unique
} as const

export type VeliteSchema = z.ZodType
export type infer<T extends z.ZodType> = z.infer<T>

/**
 * Define a schema (identity function for type inference)
 */
export const defineSchema = <T extends () => VeliteSchema>(fn: T): T => fn
