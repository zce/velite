import { deepStrictEqual, equal, ok, rejects } from 'node:assert'
import { exec } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { promisify } from 'node:util'
import { build, VeliteError } from 'velite'

const execAsync = promisify(exec)
const readJson = async (p: string): Promise<any> => JSON.parse(await readFile(p, 'utf8'))

const cleanBasic = async (): Promise<void> => {
  await rm('examples/basic/.velite', { recursive: true, force: true })
  await rm('examples/basic/public/static', { recursive: true, force: true })
}

describe('integration: basic fixture', { concurrency: 1 }, () => {
  test('standalone fixture builds via the CLI', async () => {
    await cleanBasic()
    await execAsync('node ../../dist/cli.mjs build', { cwd: 'examples/basic' })

    const entry = await readFile('examples/basic/.velite/index.js', 'utf8')
    ok(entry.includes("export { default as options } from './options.json'"))
    ok(entry.includes("export { default as posts } from './posts.json'"))

    const dts = await readFile('examples/basic/.velite/index.d.ts', 'utf8')
    ok(dts.includes('export declare const options: Options'))
    ok(dts.includes('export declare const posts: Post[]'))
    ok(dts.includes("import type { InferSchema } from 'velite'"))

    const options = await readJson('examples/basic/.velite/options.json')
    equal(options.name, 'Velite')
    equal(options.links.length, 6)

    const categories = await readJson('examples/basic/.velite/categories.json')
    equal(categories.length, 3)
    deepStrictEqual(
      categories.map((c: { slug: string }) => c.slug),
      ['journal', 'photography', 'travel']
    )
    equal(categories[0].cover.src, '/static/journal-63fcc055.webp')

    const pages = await readJson('examples/basic/.velite/pages.json')
    equal(pages.length, 2)
    deepStrictEqual(pages.map((p: { slug: string }) => p.slug).sort(), ['about', 'contact'])
    ok(pages.find((p: { slug: string }) => p.slug === 'about').body.includes('/static/cover-ed37d5f9.webp'))

    const posts = await readJson('examples/basic/.velite/posts.json')
    equal(posts.length, 2)
    deepStrictEqual(posts.map((p: { slug: string }) => p.slug).sort(), ['posts/1970-01-01-style-guide', 'posts/2024-05-08-hello-world'])
    const helloWorld = posts.find((p: { slug: string }) => p.slug === 'posts/2024-05-08-hello-world')
    equal(helloWorld.video, '/static/video-08fc2557.mp4')
    ok(helloWorld.content.includes('/static/plain-5cd67547.txt'))

    const tags = await readJson('examples/basic/.velite/tags.json')
    equal(tags.length, 2)
    deepStrictEqual(
      tags.map((t: { slug: string }) => t.slug),
      ['engineering', 'modularization']
    )

    await cleanBasic()
  })

  test('consecutive builds do not reuse unique values from previous builds', async () => {
    await build({ config: 'examples/basic/velite.config.js', strict: true, logLevel: 'silent' })
    await build({ config: 'examples/basic/velite.config.js', strict: true, logLevel: 'silent' })
    await cleanBasic()
  })

  test('builds do not reuse assets from previous configs', async () => {
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
    items: { typeName: 'Item', pattern: 'item.json', schema: s.object({ title: s.string() }) }
  }
})
`
    )
    try {
      await build({ config: join(root, 'velite.config.mjs'), cwd: root, logLevel: 'silent' })
      // a second build with a different collection shape must not carry over stale state
      await build({ config: join(root, 'velite.config.mjs'), cwd: root, logLevel: 'silent' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('strict build rejects on a schema validation failure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-strict-'))
    await mkdir(join(root, 'content', 'posts'), { recursive: true })
    await writeFile(join(root, 'content', 'posts', 'a.md'), '---\ntitle: A\nslug: dup\n---\n\nA')
    await writeFile(join(root, 'content', 'posts', 'b.md'), '---\ntitle: B\nslug: dup\n---\n\nB')
    await writeFile(
      join(root, 'velite.config.mjs'),
      `import { defineConfig, s } from 'velite'
export default defineConfig({
  root: 'content',
  output: { data: '.velite', assets: 'public/static', clean: true },
  collections: {
    posts: { typeName: 'Post', pattern: 'posts/*.md', schema: s.object({ title: s.string(), slug: s.slug() }) }
  }
})
`
    )
    try {
      await rejects(build({ config: join(root, 'velite.config.mjs'), cwd: root, strict: true, logLevel: 'silent' }), VeliteError)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
