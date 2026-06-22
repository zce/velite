import type { Diagnostic } from '../core/diagnostic'

/** Log level ordering from most verbose to least. `silent` disables all output. */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'

/**
 * Leveled progress logger for the imperative shell (driver/scheduler/builder/
 * cli). The core never calls a logger directly — only the shell does.
 *
 * `report` is the presentation sink for structured diagnostics: the pure core
 * produces Diagnostic values; the shell-injected logger decides how to show
 * them. The leveled methods are for operational progress (build started, etc.).
 *
 * All methods are required: `Runtime.logger` itself is optional, which is the
 * single layer of "no logger wired" handling. Adapters opting for partial
 * behavior should spread `silentLogger` and override the methods they care
 * about, rather than leaving methods undefined.
 */
export interface Logger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
  report(diagnostics: Diagnostic[]): void
}
