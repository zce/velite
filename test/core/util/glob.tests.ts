// test/core/util/glob.tests.ts
import { equal } from 'node:assert'
import { test } from 'node:test'

import { createMatcher } from '../../../src/core/util/glob'

test('glob: matches included paths', () => {
  const match = createMatcher(['**/*.md'])
  equal(match('posts/hello.md'), true)
  equal(match('about.md'), true)
  equal(match('posts/hello.json'), false)
})

test('glob: excludes take precedence', () => {
  const match = createMatcher(['**/*.md'], ['**/draft/**'])
  equal(match('draft/wip.md'), false)
  equal(match('posts/hello.md'), true)
})

test('glob: exact segment patterns', () => {
  const match = createMatcher(['posts/*.md'])
  equal(match('posts/a.md'), true)
  equal(match('posts/sub/a.md'), false)
})
