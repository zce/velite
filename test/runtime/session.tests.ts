import { notStrictEqual, ok, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'

import { assetStoreKey, createAssetStore } from '../../src/assets'
import { createOutputState } from '../../src/output/state'
import { createSession } from '../../src/runtime/session'

import type { Config } from '../../src/config'

const stubConfig: Config = {
  configPath: '/site/velite.config.ts',
  configImports: [],
  root: '/site/content',
  output: {
    data: '/site/.velite',
    assets: '/site/public/static',
    base: '/static/',
    name: '[name].[ext]',
    clean: false,
    format: 'esm'
  },
  loaders: [],
  collections: {},
  strict: false
} as Config

describe('BuildSession', () => {
  it('createSession produces fully-initialized session state', () => {
    const session = createSession(stubConfig, {})
    strictEqual(session.config, stubConfig)
    ok(session.files != null)
    ok(session.store != null)
    ok(session.output != null)
    ok(session.logger != null)
    strictEqual(session.resolved.size, 0)
  })

  it('two independent sessions do not share store-owned asset state', () => {
    const a = createSession(stubConfig, {})
    const b = createSession(stubConfig, {})

    a.store.getOrCreate(assetStoreKey, createAssetStore).add({ sourcePath: '/x.png', outputName: 'x.png', publicUrl: '/x.png', ownerFile: '/o' })
    strictEqual(a.store.getOrCreate(assetStoreKey, createAssetStore).list().length, 1)
    strictEqual(b.store.has(assetStoreKey), false, 'session b must not have created asset state')
    strictEqual(b.store.getOrCreate(assetStoreKey, createAssetStore).list().length, 0, 'session b must not see session a assets')
  })

  it('two independent sessions do not share custom store state', () => {
    const a = createSession(stubConfig, {})
    const b = createSession(stubConfig, {})
    const key = Symbol('test.unique')
    const createState = () => {
      const values = new Set<string>()
      return {
        add(value: string): boolean {
          if (values.has(value)) return false
          values.add(value)
          return true
        }
      }
    }

    strictEqual(a.store.getOrCreate(key, createState).add('v'), true)
    strictEqual(a.store.getOrCreate(key, createState).add('v'), false)
    strictEqual(b.store.getOrCreate(key, createState).add('v'), true)
  })

  it('two independent sessions get separate file caches by default', () => {
    const a = createSession(stubConfig, {})
    const b = createSession(stubConfig, {})
    notStrictEqual(a.files, b.files)
  })

  it('shared output state is reused when supplied', () => {
    const shared = createOutputState()
    const a = createSession(stubConfig, {}, { output: shared })
    const b = createSession(stubConfig, {}, { output: shared })
    strictEqual(a.output, shared)
    strictEqual(b.output, shared)
  })
})
