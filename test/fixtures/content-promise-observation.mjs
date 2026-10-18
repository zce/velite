import { deepEqual, equal, match, ok, rejects, throws } from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setImmediate as checkpoint } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

import { build, VeliteError } from '../../dist/index.mjs'

const mode = process.argv[2]
const entry = new URL('../../dist/index.mjs', import.meta.url).href
// These parent schemas come from the consumer's real external Zod, not `s`.
const zod = new URL('../../node_modules/zod/index.js', import.meta.url).href
const dir = await mkdtemp(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'velite-promise-'))
const controlPath = join(dir, 'control.mjs')
await writeFile(
  controlPath,
  `import { equal } from 'node:assert/strict'
   import { content, context, VeliteError } from ${JSON.stringify(entry)}
   const barrier = () => {
     let resolve
     const promise = new Promise(done => { resolve = done })
     return { promise, resolve }
   }
   export const entered = barrier(), release = barrier(), lateEntered = barrier(), lateRelease = barrier(), completed = barrier()
   export const failure = new VeliteError('internal', { message: 'original synchronous invariant' })
   export const ordinary = new Error('original asynchronous exception')
   export const lateFailure = new VeliteError('internal', { message: 'original late native rejection' })
   export const state = { parses: 0, runs: 0, emits: 0, paths: [] }
   export const doc = content.markdown({ remarkPlugins: [function () {
     const parse = this.parser
     this.parser = (...args) => { state.parses++; return parse(...args) }
     const origin = context().file.path
     return async tree => {
       state.runs++
       if (${JSON.stringify(mode)} !== 'parallel') return
       state.paths.push(origin)
       if (state.runs === 2) entered.resolve()
       await release.promise
       equal(context().file.path, origin)
       tree.children[0].children[0].value = origin.split('/').pop()
     }
   }], rehypePlugins: [function () {
     const processor = this
     return () => {
       const emit = processor.compiler
       processor.compiler = (...args) => { state.emits++; return emit(...args) }
     }
   }] })`
)
const controlUrl = pathToFileURL(controlPath).href
const control = await import(controlUrl)
const shapes = {
  nested: 'z.object({ nested, fatal })',
  tuple: 'z.preprocess(() => [{}, undefined], z.tuple([nested, fatal]))',
  intersection: 'z.intersection(z.object({ nested }), fatal)',
  'union-fault': 'z.union([z.object({ nested }), fatal])',
  'union-success': "z.union([z.object({ nested }), z.any().transform(() => 'winner')])",
  parallel: 'z.object({ html: doc.html() })',
  'late-nested': "z.union([late, z.any().transform(() => 'winner')])",
  'awaited-invariant': "z.any().transform(async () => { await Promise.resolve(); throw failure }).catch('not allowed')",
  'awaited-error': "z.any().transform(async () => { await Promise.resolve(); throw ordinary }).catch('not allowed')"
}
ok(Object.hasOwn(shapes, mode), `unknown fixture mode ${mode}`)
await mkdir(join(dir, 'content'))
await writeFile(join(dir, 'content/post.md'), '# Source')
const config = `import { context } from ${JSON.stringify(entry)}
   import { z } from ${JSON.stringify(zod)}
   import { doc, entered, release, lateEntered, lateRelease, completed, failure, ordinary, lateFailure, state } from ${JSON.stringify(controlUrl)}
   const capture = () => {
     const view = context()
     state.keys = Reflect.ownKeys(view).sort()
     state.collect = view.collectEffect
   }
   const nested = z.object({ pending: doc.html() }).prefault({})
   const fatal = z.any().transform(() => { capture(); throw failure }).catch('not allowed')
   const late = z.any().transform(async () => {
     capture()
     entered.resolve()
     await release.promise
     try {
       state.collect({ type: 'unique', group: 'late', value: 'late' }, { path: [], declaration: 0, occurrence: { kind: 'singleton' } })
     } catch (error) { state.leaseFailure = error }
     state.content = doc.html().catch('not allowed').parseAsync(undefined)
     const delayed = z.any().transform(async () => {
       lateEntered.resolve()
       await lateRelease.promise
       throw lateFailure
     })
     state.native = z.object({
       nested: z.object({ pending: delayed }).prefault({}),
       fatal: z.any().transform(() => { throw failure }).catch('not allowed')
     }).safeParseAsync({})
     completed.resolve()
     return state.native
   })
   export default { collections: { posts: { pattern: '*.md', schema: ${shapes[mode]} } } }`
await writeFile(join(dir, 'velite.config.mjs'), config)

try {
  if (mode === 'parallel') {
    const otherDir = join(dir, 'other')
    await mkdir(join(otherDir, 'content'), { recursive: true })
    await writeFile(join(otherDir, 'content/other.md'), '# Source')
    await writeFile(join(otherDir, 'velite.config.mjs'), config)
    const builds = [build({ cwd: dir, logLevel: 'silent' }), build({ cwd: otherDir, logLevel: 'silent' })]
    await control.entered.promise
    control.release.resolve()
    const [a, b] = await Promise.all(builds)
    deepEqual([a.diagnostics, b.diagnostics], [[], []])
    match(a.output.collections.posts.entries[0].data.html, /<h1 id="postmd">post\.md<\/h1>/)
    match(b.output.collections.posts.entries[0].data.html, /<h1 id="othermd">other\.md<\/h1>/)
    deepEqual([control.state.parses, control.state.runs, control.state.emits], [2, 2, 2])
    equal(new Set(control.state.paths).size, 2)
  } else if (mode === 'union-success' || mode === 'late-nested') {
    const result = await build({ cwd: dir, logLevel: 'silent', layout: 'single' })
    deepEqual(result.diagnostics, [])
    equal(result.output.collections.posts.entries[0].data, 'winner')
    if (mode === 'late-nested') {
      await control.entered.promise
      control.release.resolve()
      await control.completed.promise
      await control.lateEntered.promise
      await rejects(control.state.native, error => error === control.failure)
      await rejects(control.state.content, error => error instanceof VeliteError && error.code === 'internal')
      ok(control.state.leaseFailure instanceof VeliteError && control.state.leaseFailure.code === 'internal')
      control.lateRelease.resolve()
      // The nested Zod aggregate is deliberately unreachable. A strict child
      // checkpoint proves observation includes chains created after closure.
      await checkpoint()
      deepEqual([control.state.parses, control.state.runs, control.state.emits], [0, 0, 0])
    }
  } else {
    await rejects(build({ cwd: dir, logLevel: 'silent' }), error => error === (mode === 'awaited-error' ? control.ordinary : control.failure))
  }
  if (control.state.collect !== undefined) {
    deepEqual(control.state.keys, ['asset', 'collectEffect', 'file', 'probeImage', 'project', 'readFile', 'record', 'store'])
    throws(
      () => control.state.collect({ type: 'unique', group: 'late', value: 'late' }, { path: [], declaration: 0, occurrence: { kind: 'singleton' } }),
      error => error instanceof VeliteError && error.code === 'internal'
    )
  }
  await checkpoint()
} finally {
  control.release.resolve()
  control.lateRelease.resolve()
  await rm(dir, { recursive: true, force: true })
}
