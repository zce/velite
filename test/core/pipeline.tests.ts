import { deepStrictEqual, equal } from 'node:assert'
import { test } from 'node:test'

import { runBuild } from '../../src/core/pipeline'
import { createSession } from '../../src/core/session'

import type { Diagnostic } from '../../src/core/errors'

test('failed build run does not replace last successful snapshot', async () => {
  const session = createSession()
  await runBuild(session, { execute: async () => ({ status: 'success', result: { posts: [] }, diagnostics: [] }) })

  const failureDiagnostics: Diagnostic[] = [{ severity: 'error', code: 'x', message: 'fail', stage: 'schema' }]
  await runBuild(session, { execute: async () => ({ status: 'failure', diagnostics: failureDiagnostics }) })

  equal((session.snapshot?.result as { posts: unknown[] }).posts.length, 0)
  deepStrictEqual(session.diagnostics, failureDiagnostics)
})

test('successful build run commits a snapshot', async () => {
  const session = createSession()
  await runBuild(session, { execute: async () => ({ status: 'success', result: { posts: [{ title: 'A' }] }, diagnostics: [] }) })
  equal((session.snapshot?.result as { posts: { title: string }[] }).posts[0].title, 'A')
})

test('failed run before any success leaves no snapshot', async () => {
  const session = createSession()
  await runBuild(session, { execute: async () => ({ status: 'failure', diagnostics: [] }) })
  equal(session.snapshot, undefined)
})
