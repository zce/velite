import { equal } from 'node:assert'
import { exec } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { test } from 'node:test'

test('integration with nextjs fixtures', async t => {
  // will use velite dist
  await new Promise((res, rej) => exec('npm run build', { cwd: 'examples/nextjs' }, (e, s) => (e ? rej(e) : res(s))))

  const entry = await readFile('examples/nextjs/.velite/index.js', 'utf8')
  equal(entry.length, 288, 'entry output length should be 288')

  const dts = await readFile('examples/nextjs/.velite/index.d.ts', 'utf8')
  equal(dts.length, 632, 'dts output length should be 632')

  const options = await readFile('examples/nextjs/.velite/options.json', 'utf8')
  equal(options.length, 775, 'options output length should be 775')

  const categories = await readFile('examples/nextjs/.velite/categories.json', 'utf8')
  equal(categories.length, 649, 'categories output length should be 649')

  const pages = await readFile('examples/nextjs/.velite/pages.json', 'utf8')
  equal(pages.length, 4942, 'pages output length should be 4942')

  const posts = await readFile('examples/nextjs/.velite/posts.json', 'utf8')
  equal(posts.length, 17991, 'posts output length should be 17991')

  const tags = await readFile('examples/nextjs/.velite/tags.json', 'utf8')
  equal(tags.length, 212, 'tags output length should be 212')

  await rm('examples/nextjs/.velite', { recursive: true, force: true })
})
