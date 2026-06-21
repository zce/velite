import assert from 'node:assert/strict'
import { test } from 'node:test'

import { VeliteError } from '../../src/core/errors'

test('VeliteError carries code, context, cause, diagnostics', () => {
  const err = new VeliteError<{ path: string }>('load', {
    message: 'no loader',
    context: { path: '/x.md' },
    cause: new Error('boom'),
    diagnostics: [{ severity: 'error', code: 'load', message: 'm' }]
  })
  assert.equal(err.code, 'load')
  assert.equal(err.name, 'VeliteError')
  assert.deepEqual(err.context, { path: '/x.md' })
  assert.equal((err.cause as Error).message, 'boom')
  assert.equal(err.diagnostics.length, 1)
  assert.equal(err.message, 'no loader')
})

test('VeliteError defaults diagnostics to empty array and code optional message', () => {
  const err = new VeliteError('internal')
  assert.deepEqual(err.diagnostics, [])
  assert.equal(err.message, '')
})

test('VeliteError toString includes name, code, message, context, cause', () => {
  const err = new VeliteError<{ k: string }>('config', {
    message: 'bad',
    context: { k: 'v' },
    cause: new Error('root')
  })
  const s = err.toString()
  assert.ok(s.startsWith('VeliteError(config): bad'))
  assert.ok(s.includes('"k":"v"'))
  assert.ok(s.includes('Error: root'))
})

test('VeliteError toJSON serializes all fields', () => {
  const err = new VeliteError('output', { message: 'failed' })
  const json = err.toJSON()
  assert.equal(json.name, 'VeliteError')
  assert.equal(json.code, 'output')
  assert.equal(json.message, 'failed')
  assert.deepEqual(json.diagnostics, [])
})

test('VeliteError is a real Error (instanceof, stack captured)', () => {
  const err = new VeliteError('internal', 'x')
  assert.ok(err instanceof Error)
  assert.ok(err instanceof VeliteError)
  assert.ok(typeof err.stack === 'string')
})
