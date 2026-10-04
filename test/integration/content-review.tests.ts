import { deepEqual, equal, match } from 'node:assert/strict'
import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

import { contentProject } from '../helpers/content-build'

test('content: initialization-registered callbacks journal effects in the stage that actually invokes them', async t => {
  const project = await contentProject(
    t,
    `
    import { content, context, s } from 'velite'
    const doc = content.markdown({ remarkPlugins: [function () {
      const collect = context().collectEffect
      let start
      const trigger = new Promise(resolve => { start = resolve })
      const callback = trigger.then(() => collect(
        { type: 'unique', group: 'callback', value: 'shared' },
        { path: ['html'], declaration: 0, occurrence: { kind: 'singleton' } }
      ))
      return async (_tree, file) => {
        if (!String(file).includes('Candidate')) return
        start()
        await callback
        if (String(file).includes('Fail')) throw new Error('failed Transform')
      }
    }] })
    export default { collections: { posts: { pattern: '*.json', schema: s.object({ html: doc.html().catch('recovered'), key: s.unique('callback') }) } } }
  `,
    {
      'posts.json': JSON.stringify([
        { html: '# Candidate Fail', key: 'candidate' },
        { html: '# Neighbor', key: 'shared' }
      ])
    }
  )
  const failed = await project.build()
  deepEqual(failed.diagnostics, [])
  equal(failed.output.collections.posts!.entries.length, 2)
  equal((failed.output.collections.posts!.entries[0]!.data as { html: string }).html, 'recovered')
  await writeFile(
    join(project.dir, 'content/posts.json'),
    JSON.stringify([
      { html: '# Candidate', key: 'candidate' },
      { html: '# Neighbor', key: 'shared' }
    ])
  )
  const success = await project.build()
  equal(success.output.collections.posts!.entries.length, 0)
  equal(success.diagnostics.length, 2, 'successful Transform promotes the invocation-stage declaration')
})

test('content: a failed declaration normalization promotes none of that stage journal', async t => {
  for (const kind of ['unique', 'asset'])
    await t.test(kind, async t => {
      const project = await contentProject(
        t,
        `
      import { content, context, s } from 'velite'
      const doc = content.markdown({ remarkPlugins: [() => async (_tree, file) => {
        if (!String(file).includes('Candidate')) return
        const { collectEffect, project, record, asset } = context()
        ${
          kind === 'unique'
            ? `collectEffect({ type: 'unique', group: 'atomic', value: 'shared' }, { path: ['html'], declaration: 0, occurrence: { kind: 'singleton' } })`
            : `const linked = await asset('journal.txt', { metadata: false })
        collectEffect({ type: 'asset', owner: record.id, assetPath: project.root + '/journal.txt', publicUrl: linked.publicUrl, resolved: linked.resolved, isImage: false })`
        }
        collectEffect({ type: 'unique', group: 'atomic', get value() { throw new Error('normalization failed') } },
          { path: ['html'], declaration: 1, occurrence: { kind: 'singleton' } })
      }] })
      export default { output: { name: '[name].[ext]' }, collections: { posts: { pattern: '*.json', schema: s.object({ html: doc.html().catch('recovered'), key: s.unique('atomic') }) } } }
    `,
        {
          'posts.json': JSON.stringify([
            { html: '# Candidate', key: 'candidate' },
            { html: '# Neighbor', key: 'shared' }
          ]),
          'journal.txt': 'must not publish'
        }
      )
      const result = await project.build()
      deepEqual(result.diagnostics, [])
      equal(result.output.collections.posts!.entries.length, 2)
      equal((result.output.collections.posts!.entries[0]!.data as { html: string }).html, 'recovered')
      deepEqual(
        await readdir(join(project.dir, 'public/static')).catch(error => {
          if (error.code === 'ENOENT') return []
          throw error
        }),
        []
      )
    })
})

test('content: non-stringifiable plugin failures settle as recoverable ordinary issues without retry', { timeout: 5000 }, async t => {
  const project = await contentProject(
    t,
    `
    import { content, s } from 'velite'
    let calls = 0
    const doc = content.markdown({ remarkPlugins: [() => () => { calls++; throw Object.create(null) }] })
    export default { collections: { posts: { pattern: '*.md', schema: s.object({ html: doc.html().catch('recovered'), again: doc.html().catch('again') }).transform(value => ({ ...value, calls })) } } }
  `,
    { 'post.md': '# Source' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, { html: 'recovered', again: 'again', calls: 1 })
})

test('content: hostile ordinary exception accessors cannot turn classification into an invariant failure', async t => {
  for (const failure of [
    `const error = new Error('ordinary failure'); error.code = 'plugin'; Object.defineProperty(error, 'name', { get() { throw new Error('name getter failed') } }); throw error`,
    `const { proxy, revoke } = Proxy.revocable({}, {}); revoke(); throw proxy`
  ])
    await t.test(failure, async t => {
      const project = await contentProject(
        t,
        `
      import { content, s } from 'velite'
      const doc = content.markdown({ remarkPlugins: [() => () => { ${failure} }] })
      export default { collections: { posts: { pattern: '*.md', schema: s.object({ html: doc.html().catch('recovered') }) } } }
    `,
        { 'post.md': '# Source' }
      )
      const result = await project.build()
      deepEqual(result.diagnostics, [])
      deepEqual(result.output.collections.posts!.entries[0]!.data, { html: 'recovered' })
    })
})

test('content: multiple HTML comments do not cause surrounding visible raw HTML to disappear', async t => {
  const project = await contentProject(
    t,
    `
    import { content, s } from 'velite'
    export default { collections: { posts: { pattern: '*.md', schema: s.object({ html: content.markdown().html() }) } } }
  `,
    { 'post.md': '<!-- a --><div>visible</div><!-- b -->' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, { html: '<div>visible</div>' })
})

test('content: comment-only MDX text expressions are ignored in static heading titles', async t => {
  for (const removeComments of [true, false])
    await t.test(String(removeComments), async t => {
      const project = await contentProject(
        t,
        `
      import { content, s } from 'velite'
      const doc = content.mdx({ removeComments: ${removeComments}, minify: false })
      export default { collections: { posts: { pattern: '*.mdx', schema: s.object({ toc: doc.toc(), code: doc.code() }) } } }
    `,
        { 'post.mdx': '<h2>before{/* a */ /* b */}after</h2>' }
      )
      const result = await project.build()
      deepEqual(result.diagnostics, [])
      const value = result.output.collections.posts!.entries[0]!.data as { toc: unknown; code: string }
      deepEqual(value.toc, [{ depth: 2, title: 'before after', id: 'before-after' }])
      match(value.code, /id: "before-after"/)
    })
})

test('content: a cross-realm byte compiler result replaces VFile.value like ordinary Unified processing', async t => {
  const project = await contentProject(
    t,
    `
    import { runInNewContext } from 'node:vm'
    import { content, s } from 'velite'
    let file
    const doc = content.markdown({ rehypePlugins: [function () {
      const processor = this
      return () => { processor.compiler = (_tree, current) => { file = current; current.value = 'not bytes'; return runInNewContext('new Uint8Array([98,121,116,101,115])') } }
    }] })
    export default { collections: { posts: { pattern: '*.md', schema: s.object({ html: doc.html() }).transform(value => ({ ...value, value: String(file), result: file.result === undefined })) } } }
  `,
    { 'post.md': '# Source' }
  )
  const result = await project.build()
  deepEqual(result.diagnostics, [])
  deepEqual(result.output.collections.posts!.entries[0]!.data, { html: 'bytes', value: 'bytes', result: true })
})

test('content: non-expression object JSX IDs are invalid explicit targets, not dynamic capabilities', async t => {
  for (const value of ['{}', '[]', `new String('boxed')`])
    await t.test(value, async t => {
      const project = await contentProject(
        t,
        `
      import { content, s } from 'velite'
      const doc = content.mdx({ minify: false, rehypePlugins: [() => tree => {
        tree.children[0].attributes.push({ type: 'mdxJsxAttribute', name: 'id', value: ${value} })
      }] })
      export default { collections: { posts: { pattern: '*.mdx', schema: s.object({ toc: doc.toc(), code: doc.code().catch('recovered') }) } } }
    `,
        { 'post.mdx': '<h2>Title</h2>' }
      )
      const result = await project.build()
      deepEqual(result.output.collections.posts!.entries, [])
      deepEqual(
        result.diagnostics.map(issue => [issue.code, issue.message, issue.provenance.scope === 'record' ? issue.provenance.path : undefined]),
        [['SCHEMA_INVALID', 'Invalid explicit content id', ['toc']]]
      )
    })
})
