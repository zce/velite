import { equal } from 'node:assert'
import { exec } from 'node:child_process'
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

test('standalone fixtures', async t => {
  // will use velite dist
  await new Promise((res, rej) => exec('npm run build', { cwd: 'examples/basic' }, (e, s) => (e ? rej(e) : res(s))))

  const entry = await readFile('examples/basic/.velite/index.js', 'utf8')
  equal(entry.length, 398, 'entry output length should be 398')

  const dts = await readFile('examples/basic/.velite/index.d.ts', 'utf8')
  equal(dts.length, 632, 'dts output length should be 632')

  const options = await readFile('examples/basic/.velite/options.json', 'utf8')
  equal(options.length, 1121, 'options output length should be 1121')

  const categories = await readFile('examples/basic/.velite/categories.json', 'utf8')
  equal(categories.length, 880, 'categories output length should be 880')

  const pages = await readFile('examples/basic/.velite/pages.json', 'utf8')
  equal(pages.length, 6178, 'pages output length should be 6178')

  const posts = await readFile('examples/basic/.velite/posts.json', 'utf8')
  equal(posts.length, 14165, 'posts output length should be 14165')

  const tags = await readFile('examples/basic/.velite/tags.json', 'utf8')
  equal(tags.length, 315, 'tags output length should be 315')

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
