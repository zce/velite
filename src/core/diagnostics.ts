/**
 * Structured diagnostic model.
 *
 * Diagnostics are the build's error model. Loggers are only a presentation
 * layer over diagnostics; programmatic callers read diagnostics directly.
 */

/** Severity of a diagnostic. */
export type DiagnosticSeverity = 'info' | 'warning' | 'error'

/** Pipeline stage that produced a diagnostic. */
export type DiagnosticStage = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch'

/** A single structured diagnostic produced during a build run. */
export interface Diagnostic {
  readonly severity: DiagnosticSeverity
  readonly code: string
  readonly message: string
  readonly file?: string
  readonly collection?: string
  readonly recordId?: string
  readonly path?: Array<string | number>
  readonly stage?: DiagnosticStage
  readonly cause?: unknown
}

/** Build a diagnostic with normalized defaults. */
export const createDiagnostic = (input: Omit<Diagnostic, 'severity'> & { severity?: DiagnosticSeverity }): Diagnostic => ({
  severity: input.severity ?? 'error',
  code: input.code,
  message: input.message,
  file: input.file,
  collection: input.collection,
  recordId: input.recordId,
  path: input.path,
  stage: input.stage,
  cause: input.cause
})

/**
 * Error type thrown by `build()` / `watch()` when a build run fails.
 *
 * Carries the structured diagnostics so programmatic callers can inspect them
 * via `instanceof VeliteError` and `error.diagnostics`.
 */
export class VeliteError extends Error {
  readonly diagnostics: Diagnostic[]
  constructor(message: string, diagnostics: Diagnostic[] = []) {
    super(message)
    this.name = 'VeliteError'
    this.diagnostics = diagnostics
  }
}

/**
 * Whether a set of diagnostics contains at least one pipeline-level fatal error.
 *
 * Schema validation issues (`stage === 'schema'`) are not fatal by themselves;
 * they become fatal only when `strict` mode is enabled. All other error stages
 * (config, load, asset, prepare, output, watch) are unconditionally fatal
 * because the pipeline cannot produce a trustworthy result when they occur.
 */
export const hasFatalDiagnostic = (diagnostics: readonly Diagnostic[]): boolean => diagnostics.some(d => d.severity === 'error' && d.stage !== 'schema')
