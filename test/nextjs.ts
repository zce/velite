import assert from 'node:assert'
import { exec } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import test from 'node:test'

test.before(
  () =>
    new Promise((resolve, reject) => {
      exec('pnpm build', { cwd: 'examples/nextjs' }, err => {
        err ? reject(err) : resolve('done')
      })
    })
)

test('nextjs entry output', async t => {
  const output = await readFile('examples/nextjs/.velite/index.js', 'utf8')
  assert.equal(output.length, 288)
})

test('nextjs dts output', async t => {
  const output = await readFile('examples/nextjs/.velite/index.d.ts', 'utf8')
  assert.equal(output.length, 628)
})

test('nextjs options output', async t => {
  const output = await readFile('examples/nextjs/.velite/options.json', 'utf8')
  assert.equal(output.length, 1121)
})

test('nextjs categories output', async t => {
  const output = await readFile('examples/nextjs/.velite/categories.json', 'utf8')
  assert.equal(output.length, 880)
})

test('nextjs tags output', async t => {
  const output = await readFile('examples/nextjs/.velite/tags.json', 'utf8')
  assert.equal(output.length, 315)
})

test('nextjs pages output', async t => {
  const output = await readFile('examples/nextjs/.velite/pages.json', 'utf8')
  assert.equal(output.length, 5003)
})

test('nextjs posts output', async t => {
  const output = await readFile('examples/nextjs/.velite/posts.json', 'utf8')
  assert.equal(output.length, 20085)
})

test.after(() => rm('examples/nextjs/.velite', { recursive: true, force: true }))
