import { z } from 'zod'

import { excerpt } from './excerpt'
import { file } from './file'
import { image } from './image'
import { isodate } from './isodate'
import { markdown } from './markdown'
import { metadata } from './metadata'
import { slug } from './slug'
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
  markdown
}

export type * from 'zod'
