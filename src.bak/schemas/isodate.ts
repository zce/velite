import { z } from 'zod'

export const isodate = () =>
  z
    .string()
    .refine(value => !isNaN(Date.parse(value)), 'Invalid date string')
    .transform(value => new Date(value).toISOString())
