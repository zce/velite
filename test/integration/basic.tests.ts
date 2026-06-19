import { deepStrictEqual, equal, ok } from 'node:assert'
import { exec } from 'node:child_process'
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

test('standalone fixtures', async t => {
  // will use velite dist
  await new Promise((res, rej) => exec('node ../../dist/cli.js build', { cwd: 'examples/basic' }, (e, s) => (e ? rej(e) : res(s))))

  const entry = await readFile('examples/basic/.velite/index.js', 'utf8')
  ok(entry.includes("export { default as options } from './options.json'"))
  ok(entry.includes("export { default as posts } from './posts.json'"))

  const dts = await readFile('examples/basic/.velite/index.d.ts', 'utf8')
  ok(dts.includes('export declare const options: Option'))
  ok(dts.includes('export declare const posts: Post[]'))

  const options = JSON.parse(await readFile('examples/basic/.velite/options.json', 'utf8'))
  equal(options.name, 'Velite')
  equal(options.links.length, 6)

  const categories = JSON.parse(await readFile('examples/basic/.velite/categories.json', 'utf8'))
  equal(categories.length, 3)
  deepStrictEqual(
    categories.map((category: { slug: string }) => category.slug),
    ['journal', 'photography', 'travel']
  )
  equal(categories[0].cover.src, '/static/journal-63fcc0.webp')

  const pages = JSON.parse(await readFile('examples/basic/.velite/pages.json', 'utf8'))
  equal(pages.length, 2)
  deepStrictEqual(pages.map((page: { slug: string }) => page.slug).sort(), ['about', 'contact'])
  ok(pages.find((page: { slug: string }) => page.slug === 'about').body.includes('/static/cover-ed37d5.webp'))

  const posts = JSON.parse(await readFile('examples/basic/.velite/posts.json', 'utf8'))
  equal(posts.length, 2)
  deepStrictEqual(posts.map((post: { slug: string }) => post.slug).sort(), ['posts/1970-01-01-style-guide', 'posts/2024-05-08-hello-world'])
  const helloWorld = posts.find((post: { slug: string }) => post.slug === 'posts/2024-05-08-hello-world')
  equal(helloWorld.video, '/static/video-08fc25.mp4')
  ok(helloWorld.content.includes('/static/plain-5cd675.txt'))

  const tags = JSON.parse(await readFile('examples/basic/.velite/tags.json', 'utf8'))
  equal(tags.length, 2)
  deepStrictEqual(
    tags.map((tag: { slug: string }) => tag.slug),
    ['engineering', 'modularization']
  )

  await rm('examples/basic/.velite', { recursive: true, force: true })
})

test('consecutive builds do not reuse unique values from previous builds', async () => {
  const { build } = await import('velite')

  await build({ config: 'examples/basic/velite.config.js', strict: true })
  await build({ config: 'examples/basic/velite.config.js', strict: true })

  await rm('examples/basic/.velite', { recursive: true, force: true })
})

test('builds do not reuse assets from previous configs', async () => {
  const { build } = await import('velite')
  const root = await mkdtemp(join(tmpdir(), 'velite-assets-'))

  await mkdir(join(root, 'content'))
  await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'Hello' }))
  await writeFile(
    join(root, 'velite.config.mjs'),
    `import { defineConfig, s } from 'velite'

export default defineConfig({
  root: 'content',
  output: { data: '.velite', assets: 'public/static', clean: true },
  collections: {
    items: {
      name: 'Item',
      pattern: 'item.json',
      schema: s.object({ title: s.string() })
    }
  }
})
`
  )

  try {
    await build({ config: 'examples/basic/velite.config.js' })
    await build({ config: join(root, 'velite.config.mjs') })

    const assets = await readdir(join(root, 'public/static'))
    equal(assets.length, 0, 'asset output should not include assets from a previous config')
  } finally {
    await rm('examples/basic/.velite', { recursive: true, force: true })
    await rm(root, { recursive: true, force: true })
  }
})

test('builds do not reuse emitted assets from previous output directories', async () => {
  const { build } = await import('velite')
  const root = await mkdtemp(join(tmpdir(), 'velite-emitted-'))

  await mkdir(join(root, 'content'))
  await writeFile(join(root, 'content', 'asset.txt'), 'asset')
  await writeFile(join(root, 'content', 'item.json'), JSON.stringify({ title: 'Hello', file: 'asset.txt' }))

  const config = (assets: string) =>
    [
      "import { defineConfig, s } from 'velite'",
      '',
      'export default defineConfig({',
      "  root: 'content',",
      `  output: { data: '.velite-${assets}', assets: 'public/${assets}', clean: true, name: '[name].[ext]' },`,
      '  collections: {',
      '    items: {',
      "      name: 'Item',",
      "      pattern: 'item.json',",
      '      schema: s.object({ title: s.string(), file: s.file() })',
      '    }',
      '  }',
      '})',
      ''
    ].join('\n')

  await writeFile(join(root, 'velite.a.mjs'), config('a'))
  await writeFile(join(root, 'velite.b.mjs'), config('b'))

  try {
    await build({ config: join(root, 'velite.a.mjs') })
    await build({ config: join(root, 'velite.b.mjs') })

    await access(join(root, 'public/a/asset.txt'))
    await access(join(root, 'public/b/asset.txt'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
