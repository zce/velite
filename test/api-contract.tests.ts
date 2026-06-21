import { ok } from 'node:assert'
import { test } from 'node:test'

import * as velite from '../src/index'

test('api: exports the public surface', () => {
  const names = ['build', 'watch', 'builder', 'createBuilder', 's', 'defineConfig', 'defineCollection']
  for (const name of names) {
    ok(typeof (velite as Record<string, unknown>)[name] !== 'undefined', `missing export: ${name}`)
  }
})
