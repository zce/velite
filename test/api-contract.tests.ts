import { ok } from 'node:assert'
import { test } from 'node:test'

import * as veliteRuntime from '../src/entries/runtime'
import * as velite from '../src/index'

test('api: `velite` exports the end-user public surface', () => {
  // The default entry covers the surface a velite.config.ts author and a
  // build()/watch() caller need; advanced/adapter-author types live under
  // `velite/runtime` instead.
  const names = ['build', 'watch', 'builder', 's', 'defineConfig', 'defineCollection']
  for (const name of names) {
    ok(typeof (velite as Record<string, unknown>)[name] !== 'undefined', `missing export: ${name}`)
  }
})

test('api: `velite/runtime` exports the advanced/adapter-author surface', () => {
  // The advanced entry covers runtime adapter authors and framework
  // integrators: composition root, runtime port types, default Node adapter,
  // config facade, scheduler primitives, diagnostics helpers.
  const names = ['createBuilder', 'nodeRuntime', 'resolveConfig', 'validateConfig', 'ConfigError', 'VeliteError', 'mergeEvents', 'createLoaderRegistry']
  for (const name of names) {
    ok(typeof (veliteRuntime as Record<string, unknown>)[name] !== 'undefined', `missing export: ${name}`)
  }
})

test('api: `velite` does NOT leak runtime-adapter types as values', () => {
  // Guard rail: regression check that adapter-only values stay out of the
  // default entry. Types are not observable at runtime; this is the next best
  // proxy — none of the adapter-author *values* (createBuilder, nodeRuntime,
  // resolveConfig, …) leak into `velite`.
  const adapterOnly = ['createBuilder', 'nodeRuntime', 'resolveConfig', 'validateConfig', 'ConfigError', 'VeliteError', 'mergeEvents', 'createLoaderRegistry']
  for (const name of adapterOnly) {
    ok((velite as Record<string, unknown>)[name] === undefined, `leaked into default entry: ${name}`)
  }
})
