import { deepEqual, equal, ok, throws } from 'node:assert/strict'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

test('content: explicit Markdown definition shares source analysis without running transforms', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
let parses = 0, runs = 0, attaches = 0
function observe() { attaches++; const parse = this.parser; this.parser = (text, file) => { parses++; return parse(text, file) }; return () => { runs++ } }
const doc = content.markdown({ remarkPlugins: [observe] })
const excerpt = doc.excerpt
export default defineConfig({ collections: { posts: { pattern: '*.md', schema: s.object({ short: excerpt({ length: 2 }), text: doc.excerpt(), meta: doc.metadata() }).transform(value => ({ ...value, parses, runs, attaches })) } } })`,
    { 'post.md': '# A😀B\n\nCrème 茶 a中b isn’t' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, {
    short: 'A😀…',
    text: 'A😀B Crème 茶 a中b isn’t',
    meta: { readingTime: 1, wordCount: 7.12 },
    parses: 1,
    runs: 0,
    attaches: 1
  })
  equal(JSON.parse(await project.read('.velite/posts.json'))[0].short, 'A😀…')
})

test('content: definition identity, exact inputs, selection guard and recoverable Parse rejection are independent', async t => {
  const project = await contentProject(
    t,
    `import { content, context, defineConfig, s } from 'velite'
let parses = 0, attaches = 0
function observe() { attaches++; const parse = this.parser; this.parser = (text, file) => {
  parses++; context().collectEffect({ type: 'unique', group: 'parse', value: text }, { path: [], declaration: 0, occurrence: { kind: 'singleton' } })
  if (text === 'fail') throw new Error('parse failed'); return parse(text, file)
} }
const doc = content.markdown({ remarkPlugins: [observe] }), other = content.markdown({ remarkPlugins: [observe] })
export default defineConfig({ collections: { posts: { pattern: '*.json', schema: s.object({
 a: doc.excerpt(), b: doc.excerpt(), c: other.metadata(), d: doc.excerpt(), bad1: doc.excerpt().catch('recovered'), bad2: doc.metadata().catch({ readingTime: 1, wordCount: -1 }), empty: doc.excerpt().catch('empty'), missing: doc.excerpt().catch('missing'), invalid: doc.excerpt().catch('invalid')
}).transform(value => ({ ...value, parses, attaches })) } } })`,
    {
      'records.json': JSON.stringify([{ content: 'same', a: 'same', d: 'different', bad1: 'fail', bad2: 'fail', empty: '', invalid: 123 }])
    }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, {
    a: 'same',
    b: 'same',
    c: { readingTime: 1, wordCount: 1 },
    d: 'different',
    bad1: 'recovered',
    bad2: { readingTime: 1, wordCount: -1 },
    empty: 'empty',
    missing: 'same',
    invalid: 'invalid',
    parses: 4,
    attaches: 4
  })
})

test('content: Unicode excerpt options and full metadata have independently calculated values', async t => {
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
const doc = content.markdown()
export default defineConfig({ collections: { posts: { pattern: '*.json', schema: s.object({ excerpt: doc.excerpt({ length: 2 }), zero: doc.excerpt({ length: 0 }), meta: doc.metadata() }) } } })`,
    {
      'records.json': JSON.stringify([
        { content: 'a b', excerpt: 'a b', zero: 'abc' },
        { content: Array(398).fill('l’été').join(' '), excerpt: 'A😀B', zero: '<!-- hidden -->' },
        { content: '  \n\t', excerpt: '  ', zero: ' ' },
        { content: "'hello' a''b a中b \u{20000}", excerpt: 'q\u0301x', zero: 'abc' }
      ])
    }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  const values = result.output.collections.posts!.entries.map(entry => entry.data)
  deepEqual(values, [
    { excerpt: 'a…', zero: '…', meta: { readingTime: 1, wordCount: 2 } },
    { excerpt: 'A😀…', zero: '', meta: { readingTime: 2, wordCount: 398 } },
    { excerpt: '', zero: '', meta: { readingTime: 1, wordCount: 0 } },
    { excerpt: 'q\u0301…', zero: '…', meta: { readingTime: 1, wordCount: 6.12 } }
  ])
  const { content } = project.api
  for (const length of [-1, 1.5, NaN, Infinity, -Infinity, '2', null, 2n, new Number(2)]) {
    throws(() => content.markdown().excerpt({ length: length as number }), TypeError)
  }
})

test('content: every frozen CJK interval boundary and metadata rounding survives packaged source parsing', async t => {
  const ranges = [
    [0x2e80, 0x2e9a],
    [0x2e9b, 0x2ef4],
    [0x2f00, 0x2fd6],
    [0x3005, 0x3006],
    [0x3007, 0x3008],
    [0x3021, 0x302a],
    [0x3038, 0x303c],
    [0x3400, 0x4db6],
    [0x4e00, 0x9feb],
    [0xf900, 0xfa6e],
    [0xfa70, 0xfada],
    [0x20000, 0x2a6d7],
    [0x2a700, 0x2b735],
    [0x2b740, 0x2b81e],
    [0x2b820, 0x2cea2],
    [0x2ceb0, 0x2ebe1],
    [0x2f800, 0x2fa1e],
    [0x3041, 0x3097],
    [0x309d, 0x30a0],
    [0x1b001, 0x1b11f],
    [0x1f200, 0x1f201],
    [0x30a1, 0x30fb],
    [0x30fd, 0x3100],
    [0x31f0, 0x3200],
    [0x32d0, 0x32ff],
    [0x3300, 0x3358],
    [0xff66, 0xff70],
    [0xff71, 0xff9e],
    [0x1b000, 0x1b001]
  ]
  const points = ranges.flatMap(([start, end]) => [start, end - 1, end])
  const project = await contentProject(
    t,
    `import { content, defineConfig, s } from 'velite'
export default defineConfig({ collections: { posts: { pattern: '*.json', schema: s.object({ meta: content.markdown().metadata() }) } } })`,
    {
      'records.json': JSON.stringify(points.map(point => ({ meta: String.fromCodePoint(point) })))
    }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  result.output.collections.posts!.entries.forEach(entry => {
    const point = points[Number(entry.id.split('#').at(-1))]
    const expected = ranges.some(([start, end]) => point >= start && point < end) ? 0.56 : 0
    deepEqual(entry.data, { meta: { readingTime: 1, wordCount: expected } })
  })
  ok((await project.read('.velite/index.d.ts')).includes("Infer<Collections['posts']['schema']>"))
})
