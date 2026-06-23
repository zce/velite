import { notEqual, strictEqual } from 'node:assert/strict'
import { test } from 'node:test'

import {
  createJitiModuleLoader,
  createNodeContextStorage,
  createNodeFileSystem,
  createNodeRuntime,
  createSharpImageProcessor
} from '../../../../src/runtime/adapters/node'

test('node runtime factories create fresh runtime and adapter instances', () => {
  const first = createNodeRuntime()
  const second = createNodeRuntime()

  notEqual(first, second)
  notEqual(first.fs, second.fs)
  notEqual(first.modules, second.modules)
  notEqual(first.contextStorage, second.contextStorage)
  notEqual(first.image, second.image)
})

test('node adapter factories return runtime contract objects', () => {
  strictEqual(typeof createNodeFileSystem().read, 'function')
  strictEqual(typeof createJitiModuleLoader().load, 'function')
  strictEqual(typeof createNodeContextStorage().run, 'function')
  strictEqual(typeof createSharpImageProcessor().probe, 'function')
})
