import { equal } from 'node:assert'
import { readFile, rm } from 'node:fs/promises'
import { test } from 'node:test'

// import from source
import { build } from '../src'

test('standalone fixtures', async t => {
  await build({ config: 'examples/basic/velite.config.js' })

  const entry = await readFile('examples/basic/.velite/index.js', 'utf8')
  equal(entry.length, 288, 'entry output length should be 288')

  const dts = await readFile('examples/basic/.velite/index.d.ts', 'utf8')
  equal(dts.length, 632, 'dts output length should be 632')

  const options = await readFile('examples/basic/.velite/options.json', 'utf8')
  equal(options.length, 1121, 'options output length should be 1121')

  const categories = await readFile('examples/basic/.velite/categories.json', 'utf8')
  equal(categories.length, 880, 'categories output length should be 880')

  const pages = await readFile('examples/basic/.velite/pages.json', 'utf8')
  equal(pages.length, 6182, 'pages output length should be 6182')

  const posts = await readFile('examples/basic/.velite/posts.json', 'utf8')
  equal(posts.length, 14165, 'posts output length should be 14165')

  const tags = await readFile('examples/basic/.velite/tags.json', 'utf8')
  equal(tags.length, 315, 'tags output length should be 315')

  await rm('examples/basic/.velite', { recursive: true, force: true })
})
