import { deepStrictEqual, equal, ok } from 'node:assert'
import { test } from 'node:test'

import { VeliteError } from '../../src'

import type { Diagnostic } from '../../src'

test('VeliteError carries diagnostics', () => {
  const diagnostics: Diagnostic[] = [{ severity: 'error', code: 'schema.invalid', message: 'Invalid title', stage: 'schema', file: '/x.md' }]
  const error = new VeliteError('Build failed', diagnostics)

  ok(error instanceof Error)
  ok(error instanceof VeliteError)
  equal(error.message, 'Build failed')
  deepStrictEqual(error.diagnostics, diagnostics)
})

test('VeliteError defaults to empty diagnostics', () => {
  const error = new VeliteError('oops')
  deepStrictEqual(error.diagnostics, [])
})

test('Diagnostic severity and stage are typed literals', () => {
  const diagnostic: Diagnostic = {
    severity: 'warning',
    code: 'collection.multiple',
    message: 'multiple records',
    collection: 'options',
    stage: 'schema'
  }
  equal(diagnostic.severity, 'warning')
  equal(diagnostic.stage, 'schema')
})
