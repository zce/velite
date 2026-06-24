import assert from 'node:assert/strict'
import { test } from 'node:test'

import { processMarkdown } from '../../src/core/content/markdown'
import { processMdx } from '../../src/core/content/mdx'
import { extractText, extractToc, findReferences, parseMarkdown } from '../../src/core/content/reference'

test('processMarkdown: renders a heading and paragraph to html', async () => {
  const { html } = await processMarkdown('# Hello\n\nA paragraph.')
  assert.ok(html.includes('<h1>Hello</h1>'))
  assert.ok(html.includes('<p>A paragraph.</p>'))
})

test('processMarkdown: gfm strikethrough is enabled by default', async () => {
  const { html } = await processMarkdown('~~done~~')
  assert.ok(html.includes('<del>done</del>'), html)
})

test('processMarkdown: gfm can be disabled', async () => {
  const { html } = await processMarkdown('~~done~~', { gfm: false })
  assert.ok(!html.includes('<del>'), html)
})

test('processMarkdown: removes html comments by default', async () => {
  const { html } = await processMarkdown('a <!-- secret --> b')
  assert.ok(!html.includes('secret'), html)
})

test('processMarkdown: preserves raw html when present', async () => {
  const { html } = await processMarkdown('<div class="x">raw</div>')
  assert.ok(html.includes('<div class="x">raw</div>'), html)
})

test('processMarkdown: returns toc, excerpt and references when requested', async () => {
  const result = await processMarkdown('# Title\n\n## Sub\n\n![alt](./img.png) [link](./page.md)', {
    toc: true,
    excerpt: 50,
    references: true
  })
  assert.ok(result.toc != null)
  assert.equal(result.toc!.length, 2)
  assert.equal(result.toc![0]!.depth, 1)
  assert.equal(result.toc![0]!.title, 'Title')
  assert.equal(result.toc![1]!.slug, 'sub')
  assert.ok(typeof result.excerpt === 'string')
  assert.ok(result.references != null)
  assert.ok(result.references!.some(r => r.kind === 'image' && r.url === './img.png'))
  assert.ok(result.references!.some(r => r.kind === 'link' && r.url === './page.md'))
})

test('processMarkdown: can render from an existing mdast tree', async () => {
  const tree = parseMarkdown('# Parsed once\n\nA paragraph.')
  const { html, toc, excerpt } = await processMarkdown(tree, { toc: true, excerpt: 50 })

  assert.ok(html.includes('<h1>Parsed once</h1>'))
  assert.equal(toc?.[0]?.title, 'Parsed once')
  assert.equal(excerpt, 'Parsed once A paragraph.')
})

test('processMdx: compiles mdx source to a non-empty javascript module', async () => {
  const { code } = await processMdx('# Hello', { minify: false })
  assert.ok(code.length > 0)
  assert.ok(code.includes('Hello'), 'compiled output should preserve text content')
})

test('processMdx: minify produces shorter output', async () => {
  const minified = await processMdx('# Hello\n\nA paragraph with words.', { minify: true })
  const plain = await processMdx('# Hello\n\nA paragraph with words.', { minify: false })
  assert.ok(minified.code.length <= plain.code.length)
})

test('processMdx: collects references when requested', async () => {
  const { references } = await processMdx('![alt](./img.png)', { references: true, minify: false })
  assert.ok(references != null)
  assert.ok(references!.some(r => r.kind === 'image' && r.url === './img.png'))
})

test('processMdx: returns toc and excerpt alongside code', async () => {
  const { code, toc, excerpt } = await processMdx('# Title\n\n## Sub\n\nA short body.', { toc: true, excerpt: 50, minify: false })
  assert.ok(code.length > 0)
  assert.equal(toc?.length, 2)
  assert.equal(toc?.[0]?.title, 'Title')
  assert.equal(toc?.[1]?.slug, 'sub')
  assert.ok(typeof excerpt === 'string' && excerpt.length > 0)
})

test('extractToc: returns flat heading entries with slugs', () => {
  const tree = parseMarkdown('# Hello World\n\n## Sub Section')
  const toc = extractToc(tree)
  assert.equal(toc.length, 2)
  assert.equal(toc[0]!.depth, 1)
  assert.equal(toc[0]!.slug, 'hello-world')
  assert.equal(toc[1]!.depth, 2)
  assert.equal(toc[1]!.slug, 'sub-section')
})

test('extractText: joins text nodes and truncates with an ellipsis', () => {
  const tree = parseMarkdown('one two three four five')
  const short = extractText(tree, 8)
  assert.ok(short.endsWith('…'))
  assert.ok(short.length <= 9)
})

test('findReferences: only collects local urls', () => {
  const tree = parseMarkdown('![a](./local.png) ![b](https://ex.com/x.png) [l](./p.md) [e](#anchor)')
  const refs = findReferences(tree)
  assert.equal(refs.length, 2)
  assert.ok(refs.every(r => !r.url.startsWith('https://') && !r.url.startsWith('#')))
})

test('parseMarkdown: returns an mdast root', () => {
  const tree = parseMarkdown('# Hi')
  assert.equal(tree.type, 'root')
  assert.equal((tree as { children: { type: string }[] }).children[0]!.type, 'heading')
})
