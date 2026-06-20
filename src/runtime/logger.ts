import { sep } from 'node:path'

import { name as pkgName } from '../../package.json'

/** Log level ordering. `silent` disables all output. */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'

type LogType = 'debug' | 'info' | 'warn' | 'error'

/**
 * Public logger interface.
 *
 * Core accepts a `Logger` injection so framework integrations and tests can
 * redirect or silence output. The logger is a presentation layer only; errors
 * are always carried by the structured diagnostic model.
 */
export interface Logger {
  debug?(message: string): void
  info?(message: string): void
  warn?(message: string): void
  error?(message: string): void
}

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 }
const COLORS: Record<LogType, number> = { debug: 36, info: 32, warn: 33, error: 31 }

const identifier = `[${pkgName.toUpperCase()}]`

const flatten = (msg: string): string => {
  if (msg.includes(process.cwd())) msg = msg.replaceAll(process.cwd() + sep, '').replaceAll(process.cwd(), '.')
  return msg.replaceAll('\\', '/')
}

/**
 * Create a logger writing to the console at `level`.
 *
 * The returned logger also exposes an internal `set` method so the engine can
 * react to `--silent` / `--debug` without re-creating the logger.
 */
export const createLogger = (level: LogLevel = 'info'): Required<Logger> & { set(level: LogLevel): void } => {
  let current = LEVELS[level]
  const print = (type: LogType, message: string): void => {
    if (current > LEVELS[type]) return
    const method = type === 'debug' ? 'log' : type
    console[method](`\x1B[${COLORS[type]}m${identifier}\x1B[0m`, flatten(message))
  }
  return {
    debug: msg => print('debug', msg),
    info: msg => print('info', msg),
    warn: msg => print('warn', msg),
    error: msg => print('error', msg),
    set: next => {
      current = LEVELS[next]
    }
  }
}

/** A logger that discards everything. Useful for tests and embedded calls. */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
}

/** Default process-level logger. */
export const logger = createLogger('info')
