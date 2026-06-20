import { deepStrictEqual, equal, ok } from 'node:assert'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { collectionAffected, discover, matchPatterns } from '../../src/collections/discover'

test('matchPatterns supports negation', () => {
  equal(matchPatterns('posts/a.md', 'posts/*.md'), true)
  equal(matchPatterns('posts/a.md', ['posts/*.md', '!posts/a.md']), false)
  equal(matchPatterns('posts/b.md', ['posts/*.md', '!posts/a.md']), true)
})

test('matchPatterns normalizes against a base', () => {
  equal(matchPatterns('/repo/content/posts/a.md', 'posts/*.md', '/repo/content'), true)
})

test('discover returns absolute paths and ignores underscore-prefixed files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'velite-disc-'))
  await mkdir(join(root, 'posts'), { recursive: true })
  await writeFile(join(root, 'posts', 'a.md'), 'a')
  await writeFile(join(root, 'posts', '_draft.md'), 'draft')
  try {
    const paths = await discover(root, 'posts/*.md')
    equal(paths.length, 1)
    ok(paths[0].endsWith('a.md'))
    ok(!paths.some(p => p.includes('_draft')))
  } finally {
    const { rm } = await import('node:fs/promises')
    await rm(root, { recursive: true, force: true })
  }
})

test('collectionAffected reports whether any path matches a pattern', () => {
  const paths = new Set(['/repo/content/posts/a.md'])
  equal(collectionAffected('/repo/content', 'posts/*.md', paths), true)
  equal(collectionAffected('/repo/content', 'pages/*.md', paths), false)
})

// silence unused import warnings for assertion helpers
void deepStrictEqual
