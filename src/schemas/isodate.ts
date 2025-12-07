import { string } from 'zod'

export const isodate = () =>
  string()
    .refine(value => !isNaN(Date.parse(value)), 'Invalid date string')
    .transform<string>(value => new Date(value).toISOString())
