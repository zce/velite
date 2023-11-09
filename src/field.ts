import { z } from 'zod'

z.custom(val => {
  return val === 'string'
})
