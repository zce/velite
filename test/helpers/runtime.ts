import { createDefaultContentExecutionsFactory } from '../../src/core/content/execution/record'
import { createSchemaRunner, ensureHostInstalled } from '../../src/core/schema/runner'
import { createNodePromiseObserver } from '../../src/runtime/adapters/node/promise-observer'
import { createNodeSchemaContextHost } from '../../src/runtime/adapters/node/schema-host'

import type { BuilderDeps } from '../../src/core/builder'
import type { ImageProcessor } from '../../src/runtime/image'
import type { Logger } from '../../src/runtime/logger'
import type { Watcher } from '../../src/runtime/watcher'

export type TestRuntime = Pick<BuilderDeps, 'fs' | 'modules' | 'schemaRunner' | 'contentExecutionsFactory' | 'logger' | 'image' | 'watch'>

/**
 * Shared test host installed once per test process. Installing the identical
 * host is idempotent; tests never replace the host in beforeEach/afterEach.
 * Reuse any host already installed by a public facade or another test harness.
 */
let sharedTestHost: ReturnType<typeof createNodeSchemaContextHost> | undefined
let sharedTestObserver: ReturnType<typeof createNodePromiseObserver> | undefined
const sharedTestRunner = (): TestRuntime['schemaRunner'] => {
  if (sharedTestHost === undefined) {
    sharedTestHost = ensureHostInstalled(createNodeSchemaContextHost)
  }
  sharedTestObserver ??= createNodePromiseObserver({ runUnbound: operation => sharedTestHost!.run(undefined, operation) })
  return createSchemaRunner({ host: sharedTestHost, promiseObserver: sharedTestObserver })
}

/** Install the shared test host if needed and return a schema runner. */
export const testSchemaRunner = (): TestRuntime['schemaRunner'] => sharedTestRunner()

/** Construct a record content factory bound to the shared schema runner host. */
export const testContentExecutionsFactory = (): TestRuntime['contentExecutionsFactory'] => {
  testSchemaRunner()
  return createDefaultContentExecutionsFactory(sharedTestHost!)
}

export const noopImageProcessor: ImageProcessor = {
  probe: async () => ({ width: 0, height: 0, format: '' }),
  blurDataURL: async () => ''
}

export const noopWatch = (): Watcher => ({
  subscribe: () => () => {},
  add: () => {}
})

export interface CapturedLog {
  level: 'debug' | 'info' | 'warn' | 'error' | 'report'
  message: string
}

export const createCapturedLogger = (): { logger: Logger; logs: CapturedLog[] } => {
  const logs: CapturedLog[] = []
  return {
    logs,
    logger: {
      debug: message => logs.push({ level: 'debug', message }),
      info: message => logs.push({ level: 'info', message }),
      warn: message => logs.push({ level: 'warn', message }),
      error: message => logs.push({ level: 'error', message }),
      report: diagnostics => {
        for (const diagnostic of diagnostics) logs.push({ level: 'report', message: diagnostic.message })
      }
    }
  }
}
