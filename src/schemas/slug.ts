import { unique } from './unique'

/**
 * generate a slug schema
 * @param group unique by this, used to create a unique set of slugs
 * @param reserved reserved slugs, will be rejected
 * @returns slug schema
 */
export const slug = (group: string = 'global', reserved: string[] = []) =>
  unique(`slug:${group}`)
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug')
    .refine(value => !reserved.includes(value), 'Reserved slug')
