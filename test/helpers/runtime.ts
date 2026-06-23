import type { BuilderDeps } from '../../src/core/builder'
import type { ImageProcessor } from '../../src/runtime/image'
import type { Logger } from '../../src/runtime/logger'
import type { Watcher } from '../../src/runtime/watcher'

export type TestRuntime = Pick<BuilderDeps, 'fs' | 'modules' | 'contextStorage' | 'logger' | 'image' | 'watch'>

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
