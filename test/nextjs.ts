import assert from 'node:assert'
import { exec } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

const output = join(process.cwd(), 'examples/nextjs/.velite')

const readOutput = (path: string) => readFile(join(output, path), 'utf8')

test.before(
  () =>
    new Promise((resolve, reject) => {
      exec('pnpm build', { cwd: join(process.cwd(), 'examples/nextjs') }, err => {
        err ? reject(err) : resolve('done')
      })
    })
)

test('nextjs entry output', async t => {
  const output = await readOutput('index.js')
  assert.equal(output.length, 288)
})

test('nextjs dts output', async t => {
  const output = await readOutput('index.d.ts')
  assert.equal(output.length, 628)
})

test('nextjs options output', async t => {
  const output = await readOutput('options.json')
  assert.equal(output.length, 1121)
})

test('nextjs categories output', async t => {
  const output = await readOutput('categories.json')
  assert.equal(output.length, 880)
})

test('nextjs tags output', async t => {
  const output = await readOutput('tags.json')
  assert.equal(output.length, 315)
})

test('nextjs pages output', async t => {
  const output = await readOutput('pages.json')
  assert.equal(output.length, 5003)
})

test('nextjs posts output', async t => {
  const output = await readOutput('posts.json')
  assert.equal(output.length, 20085)
})

test.after(() => rm(output, { recursive: true, force: true }))
