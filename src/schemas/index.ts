import * as z from '../zod'
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
  isodate,
  unique,
  slug,
  file,
  image,
  metadata,
  excerpt,
  markdown,
  mdx,
  path,
  raw,
  toc
}

export type { infer, Schema, ZodType } from '../zod'
