import { deepEqual, match, ok } from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

const exec = promisify(execFile)

test('bench-large exercises markdown, mdx, toc, excerpt, and linked assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'velite-bench-test-'))
  try {
    await exec('node', ['--import', 'jiti/register', 'scripts/bench-large.ts', '--docs', '4', '--assets', '2', '--dir', root, '--json'])

    const guides = JSON.parse(await readFile(join(root, '.velite', 'guides.json'), 'utf8'))
    const pages = JSON.parse(await readFile(join(root, '.velite', 'pages.json'), 'utf8'))

    ok(guides.length > 0)
    ok(pages.length > 0)

    match(guides[0].html, /<h2[^>]*>Installation<\/h2>/)
    match(guides[0].html, /\/static\/asset-/)
    ok(guides[0].excerpt.length > 80)
    deepEqual(
      guides[0].toc.map((item: { title: string }) => item.title),
      ['Installation', 'Configuration', 'Troubleshooting']
    )

    match(pages[0].code, /function/)
    match(pages[0].code, /\/static\/asset-/)
    ok(pages[0].excerpt.length > 80)
    deepEqual(
      pages[0].toc.map((item: { title: string }) => item.title),
      ['Overview', 'Interactive Example', 'Details']
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
