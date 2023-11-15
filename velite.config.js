import { join } from 'node:path'
import z from 'zod'

console.log(join('a', 'b'))

export default {
  foo: z.string()
}
