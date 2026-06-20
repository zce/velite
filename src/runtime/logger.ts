import { sep } from 'node:path'

import { name } from '../../package.json'

type LogType = 'debug' | 'info' | 'warn' | 'error'
export type LogLevel = LogType | 'silent'

const identifier = `[${name.toUpperCase()}]`
const colors: Record<LogType, number> = { debug: 36, info: 32, warn: 33, error: 31 }
const logLevels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 }

/**
 * Structural logger interface used by core modules.
 *
 * Core code accepts a `Logger` injection so tests can redirect output.
 */
export interface Logger {
  log(msg: unknown, begin?: number): void
  info(msg: unknown, begin?: number): void
  warn(msg: unknown, begin?: number): void
  error(msg: unknown, begin?: number): void
  clear(): void
  set(level: LogLevel): void
}

const flatten = (msg: unknown): unknown => {
  if (typeof msg !== 'string') return msg
  return msg.replaceAll(process.cwd() + sep, '').replace(/\\/g, '/')
}

let currentLevel = logLevels.info

const print = (type: LogType, msg: unknown, begin?: number): void => {
  if (currentLevel > logLevels[type]) return
  const time = begin != null ? `in ${(performance.now() - begin).toFixed(2)}ms` : ''
  const method = type === 'debug' ? 'log' : type
  console[method](`\x1B[${colors[type]}m${identifier}\x1B[0m`, flatten(msg), time)
}

/**
 * Default process-level logger.
 *
 * Core modules accept a `Logger` injection so tests can redirect output.
 */
export const logger: Logger = {
  log: (msg, begin) => print('debug', msg, begin),
  info: (msg, begin) => print('info', msg, begin),
  warn: (msg, begin) => print('warn', msg, begin),
  error: (msg, begin) => print('error', msg, begin),
  clear: () => console.clear(),
  set: level => {
    currentLevel = logLevels[level]
  }
}
