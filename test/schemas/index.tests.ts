import { equal, ok } from 'node:assert'
import { test } from 'node:test'

import * as mod from '../../src'

test('root exports stable public values only', () => {
  equal(typeof mod.build, 'function')
  equal(typeof mod.watch, 'function')
  equal(typeof mod.defineConfig, 'function')
  equal(typeof mod.defineCollection, 'function')
  equal(typeof mod.defineLoader, 'function')
  equal(typeof mod.context, 'function')
  equal(typeof mod.s, 'object')
  equal(typeof mod.VeliteError, 'function')

  // internal pipeline objects must not leak to the public surface
  equal('defineSchema' in mod, false)
  equal('createEngine' in mod, false)
  equal('createResolver' in mod, false)
  equal('createWriter' in mod, false)
  equal('createBuildStore' in mod, false)
  equal('createSession' in mod, false)
  equal('createDependencyGraph' in mod, false)
  equal('createCacheRegistry' in mod, false)
})

test('schema namespace exposes built-in content schemas', () => {
  const { s } = mod
  equal(typeof s.path, 'function')
  equal(typeof s.slug, 'function')
  equal(typeof s.unique, 'function')
  equal(typeof s.file, 'function')
  equal(typeof s.image, 'function')
  equal(typeof s.markdown, 'function')
  equal(typeof s.mdx, 'function')
  equal(typeof s.raw, 'function')
  equal(typeof s.toc, 'function')
  equal(typeof s.excerpt, 'function')
  equal(typeof s.metadata, 'function')
  equal(typeof s.isoDate, 'function')
  // old lowercase alpha names are not part of the 1.0 contract
  equal('isodate' in s, false)
  equal('defineSchema' in s, false)
})

test('VeliteError is a real Error subclass', () => {
  const error = new mod.VeliteError('boom', [])
  ok(error instanceof Error)
  ok(error instanceof mod.VeliteError)
  equal(error.message, 'boom')
  ok(Array.isArray(error.diagnostics))
})
