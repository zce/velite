import { equal } from 'node:assert'
import { exec } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { test } from 'node:test'

test('integration with nextjs fixtures', async t => {
  await new Promise((res, rej) => exec('npm run build', { cwd: 'examples/nextjs' }, (e, s) => (e ? rej(e) : res(s))))

  const entry = await readFile('examples/nextjs/.velite/index.js', 'utf8')
  equal(entry.length, 288, 'entry output length should be 288')

  const dts = await readFile('examples/nextjs/.velite/index.d.ts', 'utf8')
  equal(dts.length, 628, 'dts output length should be 628')

  const options = await readFile('examples/nextjs/.velite/options.json', 'utf8')
  equal(options.length, 1121, 'options output length should be 1121')

  const categories = await readFile('examples/nextjs/.velite/categories.json', 'utf8')
  equal(categories.length, 880, 'categories output length should be 880')

  const tags = await readFile('examples/nextjs/.velite/tags.json', 'utf8')
  equal(tags.length, 315, 'tags output length should be 315')

  const pages = await readFile('examples/nextjs/.velite/pages.json', 'utf8')
  equal(pages.length, 5003, 'pages output length should be 5003')

  const posts = await readFile('examples/nextjs/.velite/posts.json', 'utf8')
  equal(posts.length, 20085, 'posts output length should be 20085')

  await rm('examples/nextjs/.velite', { recursive: true, force: true })
})
