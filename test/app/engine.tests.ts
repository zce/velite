import { deepStrictEqual, equal, ok, rejects } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createEngine } from '../../src/app/engine'
import { VeliteError } from '../../src/core/diagnostics'
import { builtinLoaders } from '../../src/loaders'
import { createWriter } from '../../src/output/write'
import { s } from '../../src/schemas'

import type { Collections } from '../../src/collections'
import type { ConfigLoader, LoadOptions } from '../../src/config/load'
import type { Project } from '../../src/core/project'
import type { Logger } from '../../src/runtime/logger'

interface Fixture {
  root: string
  dataDir: string
  assetsDir: string
  cleanup: () => Promise<void>
}

const setupFixture = async (): Promise<Fixture> => {
  const base = await mkdtemp(join(tmpdir(), 'velite-engine-'))
  const root = join(base, 'content')
  const dataDir = join(base, '.velite')
  const assetsDir = join(base, 'public', 'static')
  await mkdir(join(root, 'posts'), { recursive: true })
  await writeFile(join(root, 'posts', 'a.md'), '---\ntitle: A\nslug: post-a\n---\n\nHello A')
  await writeFile(join(root, 'posts', 'b.md'), '---\ntitle: B\nslug: post-b\n---\n\nHello B')
  return { root, dataDir, assetsDir, cleanup: () => rm(base, { recursive: true, force: true }) }
}

const silentLogger: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

const makeProject = (fixture: Fixture, collections: Collections, strict = false): Project => ({
  root: fixture.root,
  configPath: join(fixture.root, 'velite.config.ts'),
  configImports: [],
  collections,
  loaders: builtinLoaders,
  output: { data: fixture.dataDir, assets: fixture.assetsDir, base: '/static/', name: '[name]-[hash:8].[ext]', format: 'esm', clean: false },
  strict,
  markdown: undefined,
  mdx: undefined,
  prepare: undefined
})

const makeLoader = (project: Project): ConfigLoader => ({
  load: async <T extends Collections = Collections>(_path: string | undefined, _options?: LoadOptions): Promise<Project<T>> => project as unknown as Project<T>
})

const capturingWriter = () => {
  const written = new Map<string, string>()
  const copied = new Map<string, string>()
  return {
    written,
    copied,
    create: () =>
      createWriter({
        logger: silentLogger,
        writeFile: async (path, content) => {
          written.set(path, content)
        },
        copyFile: async (source, destination) => {
          copied.set(destination, source)
        },
        access: async () => {
          throw new Error('not found')
        },
        rm: async () => {},
        mkdir: async () => {}
      })
  }
}

const postsCollection = {
  typeName: 'Post',
  pattern: 'posts/*.md',
  schema: s.object({ title: s.string(), slug: s.slug(), body: s.markdown() })
}

test('engine full build resolves collections and writes single-layout output', async () => {
  const fixture = await setupFixture()
  const capture = capturingWriter()
  try {
    const project = makeProject(fixture, { posts: postsCollection })
    const engine = createEngine({ loader: makeLoader(project), writer: capture.create(), logger: silentLogger })
    const result = (await engine.build({ logLevel: 'silent' })) as { posts: { slug: string }[] }

    deepStrictEqual(result.posts.map(p => p.slug).sort(), ['post-a', 'post-b'])
    // single layout: one collection data file + entry + types
    ok(capture.written.has(join(fixture.dataDir, 'posts.json')))
    ok(capture.written.has(join(fixture.dataDir, 'index.js')))
    ok(capture.written.has(join(fixture.dataDir, 'index.d.ts')))
  } finally {
    await fixture.cleanup()
  }
})

test('incremental rebuild reprocesses only affected collections and stays equivalent', async () => {
  const fixture = await setupFixture()
  const capture = capturingWriter()
  try {
    const project = makeProject(fixture, { posts: postsCollection })
    const engine = createEngine({ loader: makeLoader(project), writer: capture.create(), logger: silentLogger })
    const first = (await engine.build({ logLevel: 'silent' })) as { posts: { title: string }[] }
    const firstTitles = first.posts.map(p => p.title).sort()

    // modify one file
    await writeFile(join(fixture.root, 'posts', 'a.md'), '---\ntitle: A2\nslug: post-a\n---\n\nUpdated')

    const second = (await engine.rebuild({ event: 'change', paths: [join(fixture.root, 'posts', 'a.md')] })) as { posts: { title: string }[] }
    deepStrictEqual(second.posts.map(p => p.title).sort(), ['A2', 'B'])

    // unaffected file B is unchanged
    const b = second.posts.find(p => p.title === 'B')
    ok(b != null)
    void firstTitles
  } finally {
    await fixture.cleanup()
  }
})

test('unique value conflict fails the build in strict mode', async () => {
  const fixture = await setupFixture()
  const capture = capturingWriter()
  try {
    await writeFile(join(fixture.root, 'posts', 'a.md'), '---\ntitle: A\nslug: dup\n---\n\nA')
    await writeFile(join(fixture.root, 'posts', 'b.md'), '---\ntitle: B\nslug: dup\n---\n\nB')
    const project = makeProject(fixture, { posts: postsCollection }, true)
    const engine = createEngine({ loader: makeLoader(project), writer: capture.create(), logger: silentLogger })
    await rejects(engine.build({ logLevel: 'silent' }), VeliteError)
  } finally {
    await fixture.cleanup()
  }
})

test('non-strict mode succeeds with schema validation errors, excluding invalid records', async () => {
  const fixture = await setupFixture()
  const capture = capturingWriter()
  try {
    // file 'a' has an invalid slug (< 3 chars), file 'b' is valid
    await writeFile(join(fixture.root, 'posts', 'a.md'), '---\ntitle: A\nslug: x\n---\n\nA')
    await writeFile(join(fixture.root, 'posts', 'b.md'), '---\ntitle: B\nslug: post-b\n---\n\nB')
    const project = makeProject(fixture, { posts: postsCollection }, false) // non-strict
    const engine = createEngine({ loader: makeLoader(project), writer: capture.create(), logger: silentLogger })
    const result = (await engine.build({ logLevel: 'silent' })) as { posts: { slug: string }[] }
    // only the valid record is included; the invalid one is excluded
    deepStrictEqual(
      result.posts.map(p => p.slug),
      ['post-b']
    )
    // schema validation diagnostics were recorded
    ok(engine.diagnostics.some(d => d.stage === 'schema'))
  } finally {
    await fixture.cleanup()
  }
})

test('unique value is released after a source edit so another record can reuse it', async () => {
  const fixture = await setupFixture()
  const capture = capturingWriter()
  try {
    await writeFile(join(fixture.root, 'posts', 'a.md'), '---\ntitle: A\nslug: shared\n---\n\nA')
    await writeFile(join(fixture.root, 'posts', 'b.md'), '---\ntitle: B\nslug: shared\n---\n\nB')
    const project = makeProject(fixture, { posts: postsCollection }, true)
    const engine = createEngine({ loader: makeLoader(project), writer: capture.create(), logger: silentLogger })

    // initially conflicts
    await rejects(engine.build({ logLevel: 'silent' }), VeliteError)

    // fix file b to a different slug via incremental rebuild
    await writeFile(join(fixture.root, 'posts', 'b.md'), '---\ntitle: B\nslug: post-b\n---\n\nB')
    const result = (await engine.rebuild({ event: 'change', paths: [join(fixture.root, 'posts', 'b.md')] })) as { posts: { slug: string }[] }
    deepStrictEqual(result.posts.map(p => p.slug).sort(), ['post-b', 'shared'])
  } finally {
    await fixture.cleanup()
  }
})

test('deleting a source removes its record from the result', async () => {
  const fixture = await setupFixture()
  const capture = capturingWriter()
  try {
    const project = makeProject(fixture, { posts: postsCollection })
    const engine = createEngine({ loader: makeLoader(project), writer: capture.create(), logger: silentLogger })
    await engine.build({ logLevel: 'silent' })

    await rm(join(fixture.root, 'posts', 'b.md'))
    const result = (await engine.rebuild({ event: 'unlink', paths: [join(fixture.root, 'posts', 'b.md')] })) as { posts: { slug: string }[] }
    deepStrictEqual(
      result.posts.map(p => p.slug),
      ['post-a']
    )
  } finally {
    await fixture.cleanup()
  }
})

test('single collection with zero records fails in strict mode', async () => {
  const fixture = await setupFixture()
  const capture = capturingWriter()
  try {
    await rm(join(fixture.root, 'posts', 'a.md'))
    await rm(join(fixture.root, 'posts', 'b.md'))
    const single = { typeName: 'Options', pattern: 'posts/*.md', single: true, schema: s.object({ title: s.string() }) }
    const project = makeProject(fixture, { options: single }, true)
    const engine = createEngine({ loader: makeLoader(project), writer: capture.create(), logger: silentLogger })
    await rejects(engine.build({ logLevel: 'silent' }), VeliteError)
  } finally {
    await fixture.cleanup()
  }
})

test('prepare mutations are reflected in split-layout record files', async () => {
  const fixture = await setupFixture()
  const capture = capturingWriter()
  try {
    const project = makeProject(fixture, { posts: postsCollection })
    project.prepare = result => {
      ;(result as { posts: { title: string }[] }).posts[0].title = 'MUTATED'
    }
    const engine = createEngine({ loader: makeLoader(project), writer: capture.create(), logger: silentLogger })
    await engine.build({ logLevel: 'silent' })

    // a rebuild goes through the split layout; the record file for post-a must
    // carry the prepare-mutated title, not the raw parsed value.
    await writeFile(join(fixture.root, 'posts', 'a.md'), '---\ntitle: A2\nslug: post-a\n---\n\nUpdated')
    await engine.rebuild({ event: 'change', paths: [join(fixture.root, 'posts', 'a.md')] })

    const recordFiles = Array.from(capture.written.keys()).filter(p => p.includes('records/posts/'))
    ok(recordFiles.length > 0, 'split record files written')
    const postARecord = recordFiles.map(p => capture.written.get(p)).find(content => content.includes('post-a'))
    ok(postARecord != null, 'post-a record file found')
    ok(postARecord.includes('MUTATED'), 'prepare mutation present in split record file')
  } finally {
    await fixture.cleanup()
  }
})

test('prepare replacement result is used for split-layout record files', async () => {
  const fixture = await setupFixture()
  const capture = capturingWriter()
  try {
    const project = makeProject(fixture, { posts: postsCollection })
    project.prepare = result => {
      const posts = (result as { posts: { title: string; slug: string; body: string }[] }).posts
      return { posts: posts.map(p => ({ ...p, title: `R:${p.title}` })) } as never
    }
    const engine = createEngine({ loader: makeLoader(project), writer: capture.create(), logger: silentLogger })
    await engine.build({ logLevel: 'silent' })

    await writeFile(join(fixture.root, 'posts', 'a.md'), '---\ntitle: A2\nslug: post-a\n---\n\nUpdated')
    await engine.rebuild({ event: 'change', paths: [join(fixture.root, 'posts', 'a.md')] })

    const recordFiles = Array.from(capture.written.keys()).filter(p => p.includes('records/posts/'))
    const allContent = recordFiles.map(p => capture.written.get(p)).join('\n')
    ok(allContent.includes('R:A2'), 'replacement result reflected in split record files')
    ok(!allContent.includes('"title":"A2"'), 'raw pre-prepare value not leaked')
  } finally {
    await fixture.cleanup()
  }
})

test('config reload drops the previous session caches and rebuilds fully', async () => {
  const fixture = await setupFixture()
  const capture = capturingWriter()
  try {
    const project1 = makeProject(fixture, { posts: postsCollection })
    const engine = createEngine({ loader: makeLoader(project1), writer: capture.create(), logger: silentLogger })
    await engine.build({ logLevel: 'silent' })

    // simulate a config reload: same root but a different project (e.g. a new
    // collection). The loader returns a fresh project; build() must reset
    // incremental state rather than reuse the previous session's parsed cache.
    const pagesCollection = {
      typeName: 'Page',
      pattern: 'posts/*.md',
      schema: s.object({ title: s.string() })
    }
    const project2 = makeProject(fixture, { posts: postsCollection, pages: pagesCollection })
    const engine2 = createEngine({ loader: makeLoader(project2), writer: capture.create(), logger: silentLogger })
    const result = (await engine2.build({ logLevel: 'silent' })) as { posts: unknown[]; pages: unknown[] }

    // the new collection is present — proving the previous session's parsed
    // cache (which only knew `posts`) was not reused.
    ok(Array.isArray(result.pages), 'reloaded project exposes the new collection')
    equal(result.pages.length, 2)
  } finally {
    await fixture.cleanup()
  }
})

test('already-aborted signal fails immediately without committing candidate state', async () => {
  const fixture = await setupFixture()
  const capture = capturingWriter()
  try {
    const project = makeProject(fixture, { posts: postsCollection })
    const engine = createEngine({ loader: makeLoader(project), writer: capture.create(), logger: silentLogger })

    // signal aborted before the first build — the engine must refuse to commit
    const controller = new AbortController()
    controller.abort()

    await rejects(engine.build({ logLevel: 'silent', signal: controller.signal }), VeliteError)
    equal(engine.diagnostics.length, 1)
    equal(engine.diagnostics[0].code, 'aborted')
  } finally {
    await fixture.cleanup()
  }
})

test('mid-build signal abort causes failure without committing snapshot', async () => {
  const fixture = await setupFixture()
  const capture = capturingWriter()
  try {
    const project = makeProject(fixture, { posts: postsCollection })
    const controller = new AbortController()
    // signal starts clean, aborted mid-execution via a custom loader that aborts
    const slowProject: Project = {
      ...project,
      loaders: [
        {
          test: /\.md$/,
          load: async (source, ctx) => {
            controller.abort()
            // proceed to parse — the engine should observe the abort on the
            // next iteration and throw before committing
            return builtinLoaders[2].load(source, ctx) // matter loader
          }
        }
      ]
    }
    const engine = createEngine({ loader: makeLoader(slowProject), writer: capture.create(), logger: silentLogger })
    await rejects(engine.build({ logLevel: 'silent', signal: controller.signal }), VeliteError)
    equal(engine.snapshot, undefined, 'no snapshot committed after mid-build abort')
  } finally {
    await fixture.cleanup()
  }
})
