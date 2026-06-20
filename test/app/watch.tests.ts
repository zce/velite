import { deepStrictEqual, equal, ok } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { build, watch } from 'velite'

import type { WatchBuildEvent } from '../../src/app/watch'

const setupFixture = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'velite-watch-'))
  await mkdir(join(root, 'content', 'posts'), { recursive: true })
  await writeFile(join(root, 'content', 'posts', 'a.md'), '---\ntitle: A\nslug: post-a\n---\n\nHello A')
  await writeFile(
    join(root, 'velite.config.mjs'),
    `import { defineConfig, s } from 'velite'
export default defineConfig({
  root: 'content',
  output: { data: '.velite', assets: 'public/static', base: '/static/', clean: true },
  collections: {
    posts: {
      typeName: 'Post',
      pattern: 'posts/*.md',
      schema: s.object({ title: s.string(), slug: s.slug(), body: s.markdown() })
    }
  }
})
`
  )
  return root
}

describe('watch lifecycle', { concurrency: 1 }, () => {
  test('watch runs an initial build and observes content changes', async () => {
    const root = await setupFixture()
    const events: WatchBuildEvent[] = []
    try {
      const watcher = await watch({
        config: join(root, 'velite.config.mjs'),
        cwd: root,
        logLevel: 'silent',
        onBuild: event => events.push(event)
      })

      equal(watcher.closed, false)
      ok(events.length >= 1, 'initial build event emitted')

      // give the file watcher a moment to finish arming after the initial build
      await new Promise(r => setTimeout(r, 300))

      // trigger a content change
      await writeFile(join(root, 'content', 'posts', 'a.md'), '---\ntitle: A2\nslug: post-a\n---\n\nUpdated')

      // wait for a rebuild event (conditional wait, no arbitrary sleep)
      const started = Date.now()
      while (events.length < 2 && Date.now() - started < 5000) {
        await new Promise(r => setTimeout(r, 50))
      }
      ok(events.length >= 2, 'rebuild event emitted after change')

      await watcher.close()
      equal(watcher.closed, true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('watch close waits for the in-flight run and marks the watcher closed', async () => {
    const root = await setupFixture()
    try {
      const watcher = await watch({ config: join(root, 'velite.config.mjs'), cwd: root, logLevel: 'silent' })
      equal(watcher.closed, false)
      await watcher.close()
      equal(watcher.closed, true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('config reload resets session state and does not reuse previous unique values', async () => {
    const root = await setupFixture()
    try {
      // first build succeeds with slug 'post-a'
      const first = await build({ config: join(root, 'velite.config.mjs'), cwd: root, logLevel: 'silent', strict: true })
      equal((first as { posts: { slug: string }[] }).posts[0].slug, 'post-a')

      // a second one-shot build (new session) must not see the first's unique state
      const second = await build({ config: join(root, 'velite.config.mjs'), cwd: root, logLevel: 'silent', strict: true })
      deepStrictEqual(
        (second as { posts: { slug: string }[] }).posts.map(p => p.slug),
        ['post-a']
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
