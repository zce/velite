import { ok, strictEqual } from 'node:assert'
import { describe, it } from 'node:test'

import { createOutputState } from '../../src/core/output-state'

describe('OutputState', () => {
  it('starts empty', () => {
    const state = createOutputState()
    strictEqual(state.emitted.size, 0)
  })

  it('two states are independent', () => {
    const a = createOutputState()
    const b = createOutputState()
    a.emitted.set('/out/a.json', '{}')
    strictEqual(b.emitted.size, 0)
    ok(a.emitted.has('/out/a.json'))
  })
})
