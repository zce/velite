import { ok, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'

import type { OutputState } from '../../src/output/state'

describe('OutputState', () => {
  it('starts empty', () => {
    const state: OutputState = { emitted: new Map() }
    strictEqual(state.emitted.size, 0)
  })

  it('two states are independent', () => {
    const a: OutputState = { emitted: new Map() }
    const b: OutputState = { emitted: new Map() }
    a.emitted.set('/out/a.json', '{}')
    strictEqual(b.emitted.size, 0)
    ok(a.emitted.has('/out/a.json'))
  })
})
