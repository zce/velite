import type { Diagnostic } from '../core/diagnostic'

/**
 * Leveled progress logger for the imperative shell (driver/scheduler/builder/
 * cli). The core never calls a logger directly — only the shell does.
 *
 * `report` is the presentation sink for structured diagnostics: the pure core
 * produces Diagnostic values; the shell-injected logger decides how to show
 * them. The leveled methods are for operational progress (build started, etc.).
 */
export interface Logger {
  debug?(message: string): void
  info?(message: string): void
  warn?(message: string): void
  error?(message: string): void
  report?(diagnostics: Diagnostic[]): void
}
