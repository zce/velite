import { name } from '../package.json'

const identifer = `[${name.toUpperCase()}]`

const logLevels = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 }

export type LogLevel = keyof typeof logLevels

const reducePath = (msg: unknown) => {
  if (typeof msg !== 'string') return msg
  // replace cwd with '.' to reduce noise, e.g.:
  // [VELITE] /home/username/project/src/file.ts:1:1 -> [VELITE] ./src/file.ts:1:1
  return msg.replace(process.cwd(), '.').replace(/\\/g, '/')
}

let logLevel = logLevels.info

export const logger = {
  log: (msg: unknown, begin?: number) => {
    if (logLevel <= logLevels.debug) console.log(`\x1B[36m${identifer}\x1B[0m`, reducePath(msg), begin ? `in ${(performance.now() - begin).toFixed(2)}ms` : '')
  },
  info: (msg: unknown, begin?: number) => {
    if (logLevel <= logLevels.info) console.info(`\x1B[32m${identifer}\x1B[0m`, reducePath(msg), begin ? `in ${(performance.now() - begin).toFixed(2)}ms` : '')
  },
  warn: (msg: unknown, begin?: number) => {
    if (logLevel <= logLevels.warn) console.warn(`\x1B[33m${identifer}\x1B[0m`, reducePath(msg), begin ? `in ${(performance.now() - begin).toFixed(2)}ms` : '')
  },
  error: (msg: unknown, begin?: number) => {
    if (logLevel <= logLevels.error) console.error(`\x1B[31m${identifer}\x1B[0m`, reducePath(msg), begin ? `in ${(performance.now() - begin).toFixed(2)}ms` : '')
  },
  clear: () => {
    console.clear()
  },
  set: (level: LogLevel) => {
    logLevel = logLevels[level]
  }
}
