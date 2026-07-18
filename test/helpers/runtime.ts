import { installSchemaContextHost } from '../../src/core/schema/host'
import { createSchemaRunner } from '../../src/core/schema/runner'
import { createNodeSchemaContextHost } from '../../src/runtime/adapters/node/schema-host'

import type { BuilderDeps } from '../../src/core/builder'
import type { ImageProcessor } from '../../src/runtime/image'
import type { Logger } from '../../src/runtime/logger'
import type { Watcher } from '../../src/runtime/watcher'

export type TestRuntime = Pick<BuilderDeps, 'fs' | 'modules' | 'schemaRunner' | 'logger' | 'image' | 'watch'>

/**
 * Shared test host installed once per test process. Installing the identical
 * host is idempotent; tests never replace the host in beforeEach/afterEach.
 * The first test to call this installs the host for the whole process.
 */
let sharedTestHost: ReturnType<typeof createNodeSchemaContextHost> | undefined
const sharedTestRunner = (): TestRuntime['schemaRunner'] => {
  if (sharedTestHost === undefined) {
    sharedTestHost = createNodeSchemaContextHost()
    installSchemaContextHost(sharedTestHost)
  }
  return createSchemaRunner(sharedTestHost)
}

/** Install the shared test host if needed and return a schema runner. */
export const testSchemaRunner = (): TestRuntime['schemaRunner'] => sharedTestRunner()

export const noopImageProcessor: ImageProcessor = {
  probe: async () => ({ width: 0, height: 0, format: '' }),
  blurDataURL: async () => ''
}

export const noopWatch = (): Watcher => ({
  subscribe: () => () => {}
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
