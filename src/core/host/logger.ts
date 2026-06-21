/**
 * Leveled progress logger for the imperative shell (driver/scheduler/builder/
 * cli). The core never calls a logger directly — only the shell does.
 *
 * M1 defines the leveled surface only. The `report(diagnostics)` method and
 * the `Diagnostic` type it carries are added in M2 when the diagnostic model
 * is unified.
 */
export interface Logger {
  debug?(message: string): void
  info?(message: string): void
  warn?(message: string): void
  error?(message: string): void
}
