import { execFileSync } from 'node:child_process'
import { test } from 'node:test'

test('content: packaged builds observe abandoned consumer-native Zod combinators without recovering synchronous invariants', async t => {
  for (const shape of ['nested', 'tuple', 'intersection', 'union-fault'])
    await t.test(shape, () => {
      execFileSync(process.execPath, ['--unhandled-rejections=strict', 'test/fixtures/content-promise-observation.mjs', shape], {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    })
})

test('content: a native union keeps its synchronous winner while observing the abandoned async content branch', () => {
  execFileSync(process.execPath, ['--unhandled-rejections=strict', 'test/fixtures/content-promise-observation.mjs', 'union-success'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  })
})

test('content: old schema contexts observe newly initialized nested native parses after successful record closure', () => {
  execFileSync(process.execPath, ['--unhandled-rejections=strict', 'test/fixtures/content-promise-observation.mjs', 'late-nested'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  })
})

test('content: simultaneous packaged builds using one definition and equal input keep their processors and async contexts isolated', () => {
  execFileSync(process.execPath, ['--unhandled-rejections=strict', 'test/fixtures/content-promise-observation.mjs', 'parallel'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    timeout: 5000
  })
})

test('content: actual packaged waiters retain thrown native Promise rejection identity and cannot use Zod catch to conceal it', async t => {
  for (const kind of ['awaited-invariant', 'awaited-error'])
    await t.test(kind, () => {
      execFileSync(process.execPath, ['--unhandled-rejections=strict', 'test/fixtures/content-promise-observation.mjs', kind], {
        cwd: process.cwd(),
        stdio: 'pipe'
      })
    })
})
