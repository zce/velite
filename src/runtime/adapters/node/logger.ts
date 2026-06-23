import { sep } from 'node:path'

import { name as pkgName } from '../../../../package.json'

import type { Diagnostic } from '../../../core/diagnostic'
import type { Logger, LogLevel } from '../../logger'

export type { LogLevel }

type LogType = 'debug' | 'info' | 'warn' | 'error'

/**
 * The shell's logger: a leveled progress surface plus `report`, the
 * presentation sink for structured diagnostics. The pure core produces
 * Diagnostic values; this logger (injected via the runtime) decides how to show
 * them. Tests/embedded callers pass `silentLogger` to mute.
 */
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 }
const COLORS: Record<LogType, number> = { debug: 36, info: 32, warn: 33, error: 31 }

const identifier = `[${pkgName.toUpperCase()}]`

const flatten = (msg: string): string => {
  if (msg.includes(process.cwd())) msg = msg.replaceAll(process.cwd() + sep, '').replaceAll(process.cwd(), '.')
  return msg.replaceAll('\\', '/')
}

const formatDiagnostic = (d: Diagnostic): string => {
  const where = [d.collection, d.file, d.path?.join('.')].filter(Boolean).join(' ')
  return `[${d.code}] ${d.message}${where ? ` (${where})` : ''}`
}

/**
 * A logger plus an internal `set` knob, returned by {@link createLogger}. Kept
 * as a structural type so callers (e.g. `setLogLevel`) can adjust the level
 * without re-creating the logger object.
 */
export type LeveledLogger = Logger & { set(level: LogLevel): void }

export interface LoggerDeps {
  level?: LogLevel
}

/**
 * Create a console logger writing at `level`. The returned logger also exposes
 * an internal `set` method so the shell can react to `--silent` / `--debug`
 * without re-creating the logger.
 */
export const createLogger = ({ level = 'info' }: LoggerDeps = {}): LeveledLogger => {
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
    report: diagnostics => {
      for (const d of diagnostics) {
        const line = formatDiagnostic(d)
        if (d.level === 'error') print('error', line)
        else if (d.level === 'warn') print('warn', line)
        else print('info', line)
      }
    },
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
  error: () => {},
  report: () => {}
}

/** Default console logger used by the Node runtime. */
export const consoleLogger: LeveledLogger = createLogger({ level: 'info' })

/** Adjust the default console logger's level at runtime (CLI `--silent`/`--verbose`). */
export const setLogLevel = (level: LogLevel): void => {
  consoleLogger.set(level)
}
