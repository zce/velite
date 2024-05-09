import assert from 'node:assert'
import { readFile, rm } from 'node:fs/promises'
import test from 'node:test'

import { build } from '../src'

test.before(() => build({ config: 'examples/basic/velite.config.js' }))

test('basic entry output', async t => {
  const output = await readFile('examples/basic/.velite/index.js', 'utf8')
  assert.equal(output.length, 288)
})

test('basic dts output', async t => {
  const output = await readFile('examples/basic/.velite/index.d.ts', 'utf8')
  assert.equal(output.length, 628)
})

test('basic options output', async t => {
  const output = await readFile('examples/basic/.velite/options.json', 'utf8')
  assert.equal(output.length, 1121)
})

test('basic categories output', async t => {
  const output = await readFile('examples/basic/.velite/categories.json', 'utf8')
  assert.equal(output.length, 880)
})

test('basic tags output', async t => {
  const output = await readFile('examples/basic/.velite/tags.json', 'utf8')
  assert.equal(output.length, 315)
})

test('basic pages output', async t => {
  const output = await readFile('examples/basic/.velite/pages.json', 'utf8')
  assert.equal(output.length, 6091)
})

test('basic posts output', async t => {
  const output = await readFile('examples/basic/.velite/posts.json', 'utf8')
  assert.equal(output.length, 14079)
})

test.after(() => rm('examples/basic/.velite', { recursive: true, force: true }))
