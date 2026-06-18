import { deepStrictEqual, equal, ok } from 'node:assert'
import { exec } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { test } from 'node:test'

test('integration with vite fixtures', async t => {
  // will use velite dist
  await new Promise((res, rej) => exec('npm run build', { cwd: 'examples/vite' }, (e, s) => (e ? rej(e) : res(s))))

  const entry = await readFile('examples/vite/.velite/index.js', 'utf8')
  ok(entry.includes("export { default as options } from './options.json'"))
  ok(entry.includes("export { default as posts } from './posts.json'"))

  const dts = await readFile('examples/vite/.velite/index.d.ts', 'utf8')
  ok(dts.includes('export declare const options: Option'))
  ok(dts.includes('export declare const posts: Post[]'))

  const options = JSON.parse(await readFile('examples/vite/.velite/options.json', 'utf8'))
  equal(options.name, 'Velite')
  equal(options.links.length, 6)

  const categories = JSON.parse(await readFile('examples/vite/.velite/categories.json', 'utf8'))
  deepStrictEqual(
    categories.map((category: { slug: string }) => category.slug),
    ['journal', 'photography', 'travel']
  )

  const pages = JSON.parse(await readFile('examples/vite/.velite/pages.json', 'utf8'))
  deepStrictEqual(pages.map((page: { slug: string }) => page.slug).sort(), ['about', 'contact'])

  const posts = JSON.parse(await readFile('examples/vite/.velite/posts.json', 'utf8'))
  deepStrictEqual(posts.map((post: { slug: string }) => post.slug).sort(), ['hello-world', 'style-guide'])

  const tags = JSON.parse(await readFile('examples/vite/.velite/tags.json', 'utf8'))
  deepStrictEqual(
    tags.map((tag: { slug: string }) => tag.slug),
    ['engineering', 'modularization']
  )

  await rm('examples/vite/.velite', { recursive: true, force: true })
})
