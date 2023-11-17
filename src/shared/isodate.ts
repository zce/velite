import { z } from 'zod'

export const isodate = () =>
  z
    .string()
    .refine(value => !isNaN(Date.parse(value)), 'Invalid date')
    .transform(value => new Date(value).toISOString())
