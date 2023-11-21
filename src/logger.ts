const identifer = '[VELITE]'

const logLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
}

let logLevel = logLevels.info

export type LogLevel = keyof typeof logLevels

export const setLogLevel = (level: LogLevel) => {
  logLevel = logLevels[level]
}

const reducePath = (msg: unknown) => {
  if (typeof msg !== 'string') return msg
  // replace cwd with '.' to reduce noise, e.g.:
  // [VELITE] /home/username/project/src/file.ts:1:1 -> [VELITE] ./src/file.ts:1:1
  return msg.replace(process.cwd(), '.')
}

export const logger = {
  log: (msg: unknown) => {
    if (logLevel <= logLevels.debug) console.log(`\x1B[36m${identifer}\x1B[0m`, reducePath(msg))
  },
  info: (msg: unknown) => {
    if (logLevel <= logLevels.info) console.info(`\x1B[32m${identifer}\x1B[0m`, reducePath(msg))
  },
  warn: (msg: unknown) => {
    if (logLevel <= logLevels.warn) console.warn(`\x1B[33m${identifer}\x1B[0m`, reducePath(msg))
  },
  error: (msg: unknown) => {
    if (logLevel <= logLevels.error) console.error(`\x1B[31m${identifer}\x1B[0m`, reducePath(msg))
  },
  clear: () => {
    console.clear()
  }
}
