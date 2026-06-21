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

/** Error codes aligned with pipeline stages plus `internal` (invariant violations) and `unknown`. */
export type VeliteErrorCode = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch' | 'internal' | 'unknown' | (string & {}) // custom escape hatch

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
export const hasFatalDiagnostic = (diagnostics: readonly Diagnostic[]): boolean => diagnostics.some(d => d.severity === 'error' && d.stage !== 'schema')

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

/** Whether `error` is an `Error` (instanceof or structural name+message). */
export const isError = (error: unknown): error is Error => error instanceof Error || (error instanceof Object && 'name' in error && 'message' in error)

/** Whether `error` is a {@link VeliteError} (instanceof or structural code+message). */
export const isVeliteError = (error: unknown): error is VeliteError =>
  error instanceof VeliteError || (error instanceof Object && 'code' in error && 'message' in error)

/** Register a `code → default message` map. Identity helper for type inference. */
export const defineErrorMap = (map: { [code in VeliteErrorCode]?: string }): { [code in VeliteErrorCode]?: string } => map
