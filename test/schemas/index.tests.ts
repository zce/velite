import { deepEqual, equal } from 'node:assert'
import { access } from 'node:fs/promises'
import { test } from 'node:test'

import { context, s } from '../../src'
import { runWithContext } from '../../src/runtime/context'

test('exports s as the public schema namespace', async () => {
  const mod = await import('../../src')

  equal('z' in mod, false)
  equal(typeof s.string, 'function')
  equal(typeof s.object, 'function')
  equal(typeof s.markdown, 'function')
})

test('exports a programmatic watch API', async () => {
  const mod = await import('../../src')
  equal(typeof mod.watch, 'function')
})

test('public entry exposes only stable advanced helpers', async () => {
  const mod = await import('../../src')

  equal(typeof mod.getImageMetadata, 'function')
  equal('createAssetStore' in mod, false)
  equal('createLogger' in mod, false)
  equal('isRelativePath' in mod, false)
  equal('logger' in mod, false)
  equal('processAsset' in mod, false)
  equal('rehypeCopyLinkedFiles' in mod, false)
  equal('remarkCopyLinkedFiles' in mod, false)
  equal('VeliteFile' in mod, false)
})

test('public domain modules own their models', async () => {
  const config = await import('../../src/config')
  const collections = await import('../../src/collections')
  const modelsDirExists = await access(new URL('../../src/models', import.meta.url)).then(
    () => true,
    () => false
  )

  equal(typeof config.defineConfig, 'function')
  equal(typeof collections.defineCollection, 'function')
  equal(modelsDirExists, false)
})

test('VeliteSchema accepts an output type parameter', () => {
  const schema = s.string()
  equal(schema.parse('hello'), 'hello')
})

test('s.path resolves file path even when input is present', async () => {
  const result = await runWithContext(
    {
      config: { root: '/site/content' } as any,
      file: { path: '/site/content/posts/hello.md' } as any
    },
    () => s.path().safeParseAsync('manual-value')
  )

  equal(result.success, true)
  if (result.success) equal(result.data, 'posts/hello')
})

test('context schemas resolve missing object fields from the current file', async () => {
  const result = await runWithContext(
    {
      config: { root: '/site/content' } as any,
      file: { content: 'Hello from file', path: '/site/content/pages/about.mdx' } as any
    },
    () => s.object({ raw: s.raw() }).safeParseAsync({})
  )

  equal(result.success, true)
  equal((result.data as any).raw, 'Hello from file')
})

const derivedSchemaContext = {
  config: { root: '/site/content', markdown: {}, mdx: {}, output: { name: '[name].[ext]', base: '/static/' } } as any,
  file: {
    content: '# Hello\n\nWorld from file',
    plain: 'Hello World from file',
    path: '/site/content/posts/hello.md'
  } as any
}

const derivedSchemaCases = [
  {
    name: 's.path()',
    schema: s.path(),
    expected: (value: unknown) => equal(value, 'posts/hello')
  },
  {
    name: 's.raw()',
    schema: s.raw(),
    expected: (value: unknown) => equal(value, '# Hello\n\nWorld from file')
  },
  {
    name: 's.markdown()',
    schema: s.markdown({ copyLinkedFiles: false }),
    expected: (value: unknown) => equal(String(value).trim(), '<h1>Hello</h1>\n<p>World from file</p>')
  },
  {
    name: 's.mdx()',
    schema: s.mdx({ copyLinkedFiles: false }),
    expected: (value: unknown) => equal(typeof value, 'string')
  },
  {
    name: 's.excerpt()',
    schema: s.excerpt({ length: 5 }),
    expected: (value: unknown) => equal(value, 'Hello')
  },
  {
    name: 's.metadata()',
    schema: s.metadata(),
    expected: (value: unknown) => equal((value as { wordCount: number }).wordCount > 0, true)
  },
  {
    name: 's.toc()',
    schema: s.toc(),
    expected: (value: unknown) => deepEqual(value, [{ title: 'Hello', url: '#hello', items: [] }])
  }
] as const

for (const { name, schema, expected } of derivedSchemaCases) {
  test(`${name} derives from the current file when the field is missing`, async () => {
    const result = await runWithContext(derivedSchemaContext, () => s.object({ value: schema }).safeParseAsync({}))

    equal(result.success, true)
    if (result.success) expected(result.data.value)
  })

  test(`${name} rejects non-string inputs`, async () => {
    const result = await runWithContext(derivedSchemaContext, () => s.object({ value: schema }).safeParseAsync({ value: 42 }))

    equal(result.success, false)
    if (!result.success)
      equal(
        result.error.issues.some(issue => issue.path.join('.') === 'value'),
        true
      )
  })
}

const valueRequiredSchemaCases = [
  { name: 's.file()', schema: s.file() },
  { name: 's.image()', schema: s.image() },
  { name: 's.slug()', schema: s.slug() },
  { name: 's.unique()', schema: s.unique() },
  { name: 's.isodate()', schema: s.isodate() }
] as const

for (const { name, schema } of valueRequiredSchemaCases) {
  test(`${name} does not make missing fields optional`, async () => {
    const result = await runWithContext(
      {
        config: { root: '/site/content' } as any,
        file: { path: '/site/content/posts/hello.md' } as any
      },
      () => s.object({ value: schema }).safeParseAsync({})
    )

    equal(result.success, false)
    if (!result.success)
      equal(
        result.error.issues.some(issue => issue.path.join('.') === 'value'),
        true
      )
  })
}

test('public build context exposes stable custom schema fields', async () => {
  const schema = s.string().transform(() => Object.keys(context()).sort())
  const result = await runWithContext(
    {
      config: { root: '/site/content' } as any,
      file: { path: '/site/content/pages/about.mdx' } as any
    },
    () => schema.safeParseAsync('value')
  )

  equal(result.success, true)
  if (result.success) equal(result.data.join(','), 'config,file,store')
})

test('public build context shares store state within a build session', async () => {
  const key = Symbol('test.store')
  const first = s.string().transform(() => {
    const state = context().store.getOrCreate(key, () => ({ count: 0 }))
    state.count += 1
    return state.count
  })
  const second = s.string().transform(() => {
    const state = context().store.getOrCreate(key, () => ({ count: 0 }))
    state.count += 1
    return state.count
  })

  const result = await runWithContext(
    {
      config: { root: '/site/content' } as any,
      file: { path: '/site/content/pages/about.mdx' } as any
    },
    async () => [await first.parseAsync('one'), await second.parseAsync('two')]
  )

  equal(result.join(','), '1,2')
})

test('build context helpers are not public entry exports', async () => {
  const mod = await import('../../src')
  equal('parseWithContext' in mod, false)
  equal('runWithContext' in mod, false)
  equal('defineStoreKey' in mod, false)
})
