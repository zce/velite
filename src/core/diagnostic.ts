// Structured diagnostic model — the build's error model. Loggers are only a
// presentation layer over diagnostics; programmatic callers read diagnostics
// directly.
//
// This module fuses z-labs's diagnostic vocabulary (level/code/DiagnosticCode
// closed set + `diagnostic()` factory) with the current `errors.ts` error
// machinery (VeliteError / fail / assert / hasFatalDiagnostic / codeFromDiagnostics).
// The field is `level` ('error' | 'warn' | 'info'); schema-stage errors are
// non-fatal by themselves.

import type { Collection, SourcePath } from './model'

export type DiagnosticLevel = 'error' | 'warn' | 'info'

/** Pipeline stage that produced a diagnostic. */
export type DiagnosticStage = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch'

/** Stable, machine-readable diagnostic codes. A closed set — extend explicitly. */
export type DiagnosticCode =
  | 'CONFIG_LOAD_FAILED'
  | 'CONFIG_INVALID'
  | 'SOURCE_READ_FAILED'
  | 'LOADER_FAILED'
  | 'SCHEMA_INVALID'
  | 'COLLECTION_EMPTY'
  | 'COLLECTION_MULTIPLE'
  | 'ASSET_FAILED'
  | 'OUTPUT_FAILED'
  | 'REBUILD_FAILED'

/**
 * Structured diagnostic. The single source of truth for failures; logging is
 * just one presentation of these. Not every field applies to every diagnostic.
 */
export interface Diagnostic {
  level: DiagnosticLevel
  code: DiagnosticCode
  message: string
  file?: SourcePath
  collection?: Collection
  /** Field path within a record, e.g. ['meta', 'date']. */
  path?: Array<string | number>
  /** Pipeline stage that produced this diagnostic. */
  stage?: DiagnosticStage
  /** Stable identity of the record this diagnostic concerns. */
  recordId?: string
  /** Original underlying error or value. */
  cause?: unknown
}

/** Build a diagnostic. `extra` may carry stage/recordId/file/collection/path/cause. */
export const diagnostic = (
  level: DiagnosticLevel,
  code: DiagnosticCode,
  message: string,
  extra?: Omit<Diagnostic, 'level' | 'code' | 'message'>
): Diagnostic => ({ level, code, message, ...extra })

/** Error codes aligned with pipeline stages plus `internal` (invariant violations) and `unknown`. */
export type VeliteErrorCode = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch' | 'internal' | 'unknown'

/** Options for constructing a {@link VeliteError}. */
export type VeliteErrorOptions<T = unknown> = {
  message?: string
  context?: T
  cause?: unknown
  diagnostics?: Diagnostic[]
}

/**
 * Error type thrown by `build()` / `watch()` on build failure and by internal
 * `fail()` / `assert()` calls for invariant violations.
 *
 * Carries a typed `code` (aligned with pipeline stages), optional `context`,
 * the standard `cause`, and — when representing a build failure — the
 * structured `diagnostics` that triggered it. Programmatic callers inspect via
 * `instanceof VeliteError`, `error.code`, and `error.diagnostics`.
 */
export class VeliteError<T = unknown> extends Error {
  public readonly name = 'VeliteError'
  public readonly code: VeliteErrorCode
  public readonly context?: T
  public readonly diagnostics: Diagnostic[]

  constructor(code: VeliteErrorCode, options?: VeliteErrorOptions<T>) {
    super(options?.message, options)
    this.code = code
    this.context = options?.context
    this.diagnostics = options?.diagnostics ?? []
    Error.captureStackTrace?.(this, this.constructor)
    Object.setPrototypeOf(this, new.target.prototype)
  }

  toString(): string {
    const context = this.context ? ` ${JSON.stringify(this.context)}` : ''
    const cause = this.cause ? ` ${this.cause}` : ''
    return `${this.name}(${this.code}): ${this.message}${context}${cause}`
  }

  toJSON(): { name: string; code: VeliteErrorCode; message: string; context: unknown; cause: unknown; diagnostics: Diagnostic[] } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause,
      diagnostics: this.diagnostics
    }
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
export const hasFatalDiagnostic = (diagnostics: readonly Diagnostic[]): boolean => diagnostics.some(d => d.level === 'error' && d.stage !== 'schema')

/**
 * Pick the {@link VeliteErrorCode} for a thrown build-failure `VeliteError`:
 * the `stage` of the first fatal diagnostic (error level, non-schema —
 * mirroring {@link hasFatalDiagnostic}), or `'unknown'` if none.
 */
export const codeFromDiagnostics = (diagnostics: readonly Diagnostic[]): VeliteErrorCode => {
  const fatal = diagnostics.find(d => d.level === 'error' && d.stage !== 'schema')
  return (fatal?.stage ?? 'unknown') as VeliteErrorCode
}

/** Throw a {@link VeliteError}. Never returns. */
export function fail(code: VeliteErrorCode, message?: string): never
export function fail<T = unknown>(code: VeliteErrorCode, options?: VeliteErrorOptions<T>): never
export function fail(code: VeliteErrorCode, options?: string | VeliteErrorOptions): never {
  throw new VeliteError(code, typeof options === 'string' ? { message: options } : options)
}

/**
 * Assert `condition` is truthy, otherwise throw a {@link VeliteError} via
 * {@link fail}. Acts as an `asserts condition` type guard.
 */
export function assert(condition: unknown, code: VeliteErrorCode, message?: string): asserts condition
export function assert<T = unknown>(condition: unknown, code: VeliteErrorCode, options?: VeliteErrorOptions<T>): asserts condition
export function assert(condition: unknown, throwError: () => never): asserts condition
export function assert(condition: unknown, error: VeliteErrorCode | (() => never), options?: string | VeliteErrorOptions): asserts condition {
  if (!condition) {
    if (typeof error === 'string') fail(error, options as VeliteErrorOptions)
    else error()
  }
}

/** Flatten any thrown value to a stable string for logging. */
export const flattenError = (error: unknown): string => {
  if (isVeliteError(error)) return error.code
  if (isError(error)) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error != null) return JSON.stringify(error)
  return 'unknown'
}

/** Whether `error` is an `Error`. */
export const isError = (error: unknown): error is Error => error instanceof Error

/** Whether `error` is a {@link VeliteError} (instanceof, or an `Error` named `VeliteError` carrying a `code`). */
export const isVeliteError = (error: unknown): error is VeliteError =>
  error instanceof VeliteError || (error instanceof Error && 'code' in error && error.name === 'VeliteError')
