import { strictEqual } from 'node:assert'
import { describe, it } from 'node:test'

import { matchPatterns } from '../src/utils'

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
