import { deepEqual, match, ok } from 'node:assert/strict'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

test('content: migrated Markdown rendering preserves GFM, raw HTML and comment option behavior', async t => {
  for (const gfm of [true, false])
    for (const removeComments of [true, false])
      await t.test(`${gfm}/${removeComments}`, async t => {
        const project = await contentProject(
          t,
          `import {content,defineConfig,s} from 'velite'
const doc=content.markdown({gfm:${gfm},removeComments:${removeComments}})
export default defineConfig({collections:{posts:{pattern:'*.md',schema:s.object({html:doc.html()})}}})`,
          { 'post.md': '# Hello\n\n~~done~~\n\n<div class="x">raw<!-- secret --></div>' }
        )
        const result = await project.build()
        deepEqual(result.diagnostics, [])
        const html = (result.output.collections.posts!.entries[0]!.data as { html: string }).html
        match(html, /<h1 id="hello">Hello<\/h1>/)
        ok(html.includes('<del>') === gfm)
        ok(html.includes('secret') !== removeComments)
        match(html, /<div class="x">raw/)
      })
})

test('content: real MDX minification reduces the same generated module workload', async t => {
  const project = await contentProject(
    t,
    `import {content,defineConfig,s} from 'velite'
const minified=content.mdx({minify:true}),plain=content.mdx({minify:false})
export default defineConfig({collections:{posts:{pattern:'*.mdx',schema:s.object({minified:minified.code(),plain:plain.code()})}}})`,
    { 'post.mdx': '# Hello\n\nA paragraph with words.' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const value = result.output.collections.posts!.entries[0]!.data as { plain: string; minified: string }
  match(value.plain, /Hello/)
  match(value.minified, /Hello/)
  ok(value.minified.length <= value.plain.length)
})

test('content: migrated reference handling rewrites local links but preserves external and fragment targets', async t => {
  const project = await contentProject(
    t,
    `import {content,defineConfig,s} from 'velite'
const doc=content.markdown()
export default defineConfig({output:{name:'[name].[ext]'},collections:{posts:{pattern:'*.md',schema:s.object({html:doc.html(),toc:doc.toc(),excerpt:doc.excerpt({length:8})})}}})`,
    { 'post.md': '# Hello World\n\n[Local](./asset.txt) [External](https://example.com/) [Fragment](#hello-world)', 'asset.txt': 'asset' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const value = result.output.collections.posts!.entries[0]!.data as { html: string; toc: unknown; excerpt: string }
  match(value.html, /href="\/static\/asset.txt"/)
  match(value.html, /href="https:\/\/example.com\/"/)
  match(value.html, /href="#hello-world"/)
  deepEqual(value.toc, [{ depth: 1, title: 'Hello World', id: 'hello-world' }])
  deepEqual(value.excerpt, 'Hello Wo…')
})
