import assert from 'node:assert'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

import { build } from '../src'

const output = join(process.cwd(), 'examples/basic/.velite')

const readOutput = (path: string) => readFile(join(output, path), 'utf8')

test.before(() => build({ config: join(process.cwd(), 'examples/basic/velite.config.js') }))

test('basic entry output', async t => {
  const output = await readOutput('index.js')
  assert.equal(output.length, 288)
})

test('basic dts output', async t => {
  const output = await readOutput('index.d.ts')
  assert.equal(output.length, 628)
})

test('basic options output', async t => {
  const output = await readOutput('options.json')
  assert.equal(output.length, 1121)
})

test('basic categories output', async t => {
  const output = await readOutput('categories.json')
  assert.equal(output.length, 880)
})

test('basic tags output', async t => {
  const output = await readOutput('tags.json')
  assert.equal(output.length, 315)
})

test('basic pages output', async t => {
  const output = await readOutput('pages.json')
  assert.equal(output.length, 6149)
})

test('basic posts output', async t => {
  const output = await readOutput('posts.json')
  assert.equal(output.length, 14079)
})

test.after(() => rm(output, { recursive: true, force: true }))
