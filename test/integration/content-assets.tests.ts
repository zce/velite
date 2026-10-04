import { deepEqual, match } from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

test('content assets: each rewritten HTML property retains its own asset target', async t => {
  const project = await contentProject(
    t,
    `import {content,defineConfig,s} from 'velite'
const doc=content.markdown()
export default defineConfig({output:{name:'[name].[ext]'},collections:{posts:{pattern:'*.md',schema:s.object({html:doc.html(),toc:doc.toc()})}}})`,
    {
      'post.md': '<video src="./a.txt" poster="./b.txt"></video>\n\n<video src="https://example.com/remote.mp4" poster="./b.txt"></video>',
      'a.txt': 'a',
      'b.txt': 'b'
    }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const html = (result.output.collections.posts!.entries[0]!.data as { html: string }).html
  match(html, /src="\/static\/a.txt" poster="\/static\/b.txt"/)
  match(html, /src="https:\/\/example.com\/remote.mp4" poster="\/static\/b.txt"/)
  deepEqual(await readdir(join(project.dir, 'public/static')), ['a.txt', 'b.txt'])
})

test('content assets: intrinsic inline MDX JSX links participate in TOC-only transform asset work', async t => {
  const project = await contentProject(
    t,
    `import {content,defineConfig,s} from 'velite'
const doc=content.mdx({minify:false})
export default defineConfig({output:{name:'[name].[ext]'},collections:{posts:{pattern:'*.mdx',schema:s.object({toc:doc.toc()}).transform(async value=>({...value,code:await doc.code().parseAsync(undefined)}))}}})`,
    { 'post.mdx': '# Title\n\nText <img src="./a.txt" />', 'a.txt': 'a' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  match((result.output.collections.posts!.entries[0]!.data as { code: string }).code, /\/static\/a.txt/)
  deepEqual(await readdir(join(project.dir, 'public/static')), ['a.txt'])
})
