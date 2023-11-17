import z from 'zod'

import { excerpt } from './excerpt'
import { file } from './file'
import { image } from './image'
import { isodate } from './isodate'
import { markdown } from './markdown'
import { metadata } from './metadata'
import { slug } from './slug'

export const s = {
  ...z,
  slug,
  file,
  image,
  isodate,
  metadata,
  excerpt,
  markdown
}
