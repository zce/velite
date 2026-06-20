import { deepEqual, ok, strictEqual } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { describe, it } from 'node:test'

import { discover, matchPatterns } from '../../src/utils/patterns'

describe('matchPatterns function', async t => {
  it('matches single pattern', () => {
    strictEqual(matchPatterns('foo/bar.js', '**/*.js'), true)
    strictEqual(matchPatterns('foo/bar.ts', '**/*.js'), false)
  })

  it('matches multiple patterns', () => {
    strictEqual(matchPatterns('foo/bar.js', ['**/*.js', '**/*.ts']), true)
    strictEqual(matchPatterns('foo/bar.css', ['**/*.js', '**/*.ts']), false)
  })

  it('handles negated patterns', () => {
    strictEqual(matchPatterns('foo/bar.js', ['**/*.js', '!**/node_modules/**']), true)
    strictEqual(matchPatterns('node_modules/foo/bar.js', ['**/*.js', '!**/node_modules/**']), false)
  })
})

describe('discover', () => {
  it('returns absolute files matching collection patterns and ignores private files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'velite-discover-'))

    try {
      await mkdir(join(root, 'posts', 'private'), { recursive: true })
      await mkdir(join(root, 'posts', 'nested'), { recursive: true })
      await writeFile(join(root, 'posts', 'a.md'), '')
      await writeFile(join(root, 'posts', 'nested', 'b.md'), '')
      await writeFile(join(root, 'posts', 'private', 'hidden.md'), '')
      await writeFile(join(root, 'posts', '_draft.md'), '')

      const paths = await discover(root, ['posts/**/*.md', '!posts/private/**'])

      ok(paths.every(path => isAbsolute(path)))
      deepEqual(paths.sort(), [join(root, 'posts', 'a.md'), join(root, 'posts', 'nested', 'b.md')].sort())
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
