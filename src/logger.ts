import { name } from '../package.json'

const identifer = name.toUpperCase()

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

let logLevel = LogLevel.INFO

export const setLogLevel = (level: LogLevel) => {
  logLevel = level
}

export const logger = {
  log: (msg: string) => {
    if (logLevel <= LogLevel.DEBUG) console.log(`[${identifer}] ${msg}`)
  },
  info: (msg: string) => {
    if (logLevel <= LogLevel.INFO) console.info(`\x1B[32m[${identifer}] ${msg}\x1B[0m`)
  },
  warn: (msg: string) => {
    if (logLevel <= LogLevel.WARN) console.warn(`\x1B[33m[${identifer}] ${msg}\x1B[0m`)
  },
  error: (msg: string) => {
    if (logLevel <= LogLevel.ERROR) console.error(`\x1B[31m[${identifer}] ${msg}\x1B[0m`)
  },
  clear: () => {
    console.clear()
  }
}
