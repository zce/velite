import { deepEqual, ok } from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const root = fileURLToPath(new URL('../../', import.meta.url))
const run = promisify(execFile)

test('migrated examples: packaged config self-reference and generated content consumer declarations agree', async t => {
  const { build } = await import('../../dist/index.mjs')
  for (const example of ['nextjs', 'vite'])
    await t.test(example, async t => {
      const source = join(root, 'examples', example)
      const dir = await mkdtemp(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'velite-example-'))
      t.after(() => rm(dir, { recursive: true, force: true }))
      await cp(join(source, 'content'), join(dir, 'content'), { recursive: true })
      await cp(join(source, 'velite.config.ts'), join(dir, 'velite.config.ts'))
      await writeFile(join(dir, 'package.json'), '{"type":"module"}')
      await symlink(join(source, 'node_modules'), join(dir, 'node_modules'), 'dir')
      // Reuse read-only history for timestamp schemas, without creating commits.
      const previous = { GIT_DIR: process.env.GIT_DIR, GIT_WORK_TREE: process.env.GIT_WORK_TREE }
      process.env.GIT_DIR = join(root, '.git')
      process.env.GIT_WORK_TREE = dir
      try {
        const result = await build({ cwd: dir, logLevel: 'silent', layout: 'single' })
        deepEqual(result.diagnostics, [])
        const posts = JSON.parse(await readFile(join(dir, '.velite/posts.json'), 'utf8')) as {
          toc: { id: string; depth: number; title: string }[]
          content: string
        }[]
        ok(posts.length > 0)
        for (const post of posts) for (const heading of post.toc) ok(post.content.includes(`id="${heading.id}"`), `missing actual target ${heading.id}`)
        await writeFile(
          join(dir, 'consumer.ts'),
          `
        import { posts, pages } from './.velite/index.js'
        import type { TocItem, Metadata } from 'velite'
        const toc: TocItem[] = posts[0]!.toc
        const metadata: Metadata = posts[0]!.metadata
        const html: string = posts[0]!.content
        const code: string = pages[0]!.body
        // @ts-expect-error actual targets are IDs, not title-derived slugs
        toc[0]!.slug
        void [toc, metadata, html, code]
      `
        )
        await run(
          join(root, 'node_modules/.bin/tsc'),
          [
            '--noEmit',
            '--strict',
            '--skipLibCheck',
            '--module',
            'NodeNext',
            '--moduleResolution',
            'NodeNext',
            '--target',
            'ES2023',
            '--types',
            'node',
            '--typeRoots',
            join(root, 'node_modules/@types'),
            '--allowImportingTsExtensions',
            'consumer.ts'
          ],
          { cwd: dir }
        )
      } finally {
        for (const name of ['GIT_DIR', 'GIT_WORK_TREE'] as const) {
          if (previous[name] === undefined) delete process.env[name]
          else process.env[name] = previous[name]
        }
      }
    })
})
