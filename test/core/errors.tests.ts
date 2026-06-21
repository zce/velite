import assert from 'node:assert/strict'
import { test } from 'node:test'

import { codeFromDiagnostics, createDiagnostic, fail, flattenError, isError, isVeliteError, assert as veliteAssert, VeliteError } from '../../src/core/errors'

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

test('fail throws a VeliteError with the given code', () => {
  assert.throws(
    () => fail('internal', 'session missing'),
    (err: unknown) => err instanceof VeliteError && err.code === 'internal' && err.message === 'session missing'
  )
})

test('fail accepts an options object', () => {
  assert.throws(
    () => fail('load', { message: 'no loader', context: { path: '/x' } }),
    (err: unknown) => err instanceof VeliteError && (err as VeliteError).context?.path === '/x'
  )
})

test('assert passes through when condition is truthy', () => {
  const value = 'x'
  veliteAssert(value, 'internal', 'should not throw')
  // reaching here means no throw
})

test('assert throws when condition is falsy', () => {
  assert.throws(() => veliteAssert(false, 'internal', 'bad'), VeliteError)
})

test('assert narrows the type (asserts condition)', () => {
  const maybe: string | undefined = 'present'
  veliteAssert(maybe != null, 'internal', 'missing')
  // after assert, maybe is string — this line type-checks only if narrowing works
  const len: number = maybe.length
  assert.equal(len, 7)
})

test('assert accepts a throw thunk overload', () => {
  assert.throws(
    () => veliteAssert(false, () => fail('config', 'from thunk')),
    (e: unknown) => e instanceof VeliteError && (e as VeliteError).code === 'config'
  )
})

test('flattenError normalizes each input shape', () => {
  assert.equal(flattenError(new VeliteError('internal', 'x')), 'internal')
  assert.equal(flattenError(new Error('plain')), 'plain')
  assert.equal(flattenError('a string'), 'a string')
  assert.equal(flattenError({ a: 1 }), '{"a":1}')
  assert.equal(flattenError(42), 'unknown')
  assert.equal(flattenError(null), 'unknown')
})

test('isError and isVeliteError classify Error subtypes correctly', () => {
  assert.equal(isError(new Error('x')), true)
  assert.equal(isError(new VeliteError('internal')), true)
  assert.equal(isError('nope'), false)
  assert.equal(isVeliteError(new VeliteError('internal')), true)
  assert.equal(isVeliteError(new Error('plain')), false)
})

test('isVeliteError rejects Node-style system errors (code + message but not VeliteError)', () => {
  const sysErr = Object.assign(new Error('not found'), { code: 'ENOENT' })
  assert.equal(isVeliteError(sysErr), false)
  // and flattenError on it returns the message, not 'ENOENT'
  assert.equal(flattenError(sysErr), 'not found')
})

test('codeFromDiagnostics returns the fatal stage', () => {
  const diags = [
    createDiagnostic({ severity: 'warning', code: 'w', message: 'w', stage: 'schema' }),
    createDiagnostic({ severity: 'error', code: 'e', message: 'e', stage: 'asset' })
  ]
  assert.equal(codeFromDiagnostics(diags), 'asset')
})

test('codeFromDiagnostics skips schema-only errors (non-fatal)', () => {
  const diags = [createDiagnostic({ severity: 'error', code: 'e', message: 'e', stage: 'schema' })]
  assert.equal(codeFromDiagnostics(diags), 'unknown')
})

test('codeFromDiagnostics falls back to unknown on empty', () => {
  assert.equal(codeFromDiagnostics([]), 'unknown')
})
