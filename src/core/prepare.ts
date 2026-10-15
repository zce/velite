import { diagnostic, equalDiagnosticValue, normalizeDiagnosticValue, VeliteError } from './diagnostic'

import type { PrepareContext, PrepareDiagnosticInput } from './config'
import type { Diagnostic, DiagnosticValue } from './diagnostic'

// Sole append-only prepare diagnostic sink, consumed by the driver's
// `runPrepareHook` phase. `addDiagnostic` synchronously normalizes and
// snapshots `cause`, appends a `prepare`-stage diagnostic with
// `origin = { kind: 'prepare-hook', key }` and project provenance, then closes
// at hook settlement. Late calls throw `VeliteError('internal')` and append
// nothing. Exact same-key declarations collapse. Reusing a key with a
// different normalized payload yields one Velite-authored fatal prepare
// conflict diagnostic and selects no winner. Reversing call or completion
// order yields the same set and order.
//
// A hook declaration is accepted only when ordinary reflection reports an
// Object-prototype or null-prototype record containing exactly own data
// properties `key`, `level`, `code`, `message`, and optional `cause`. Unknown
// string keys, symbol keys, accessors, inherited fields, invalid levels, or
// empty key/code are malformed; reflection failure is malformed. No Proxy
// detector is used. A malformed call is a user prepare-hook bug, not a velite
// invariant: it appends nothing of the input and records one Velite-authored
// error diagnostic instead, so the build fails through the ordinary fatal
// gate rather than an internal fault (see .agents/knowledge/error-handling.md).

/** Internal sink entry. `conflict === true` marks a same-key payload clash. */
interface SinkEntry {
  readonly input: PrepareDiagnosticInput
  readonly normalizedCause: DiagnosticValue | undefined
  readonly conflict?: true
}

export interface PrepareSink {
  /** Snapshot of the diagnostics appended so far. */
  readonly diagnostics: readonly Diagnostic[]
  /** The sink's `addDiagnostic` closure, bound to this sink. */
  readonly addDiagnostic: PrepareContext['addDiagnostic']
  /** Close the sink at hook settlement. Idempotent. */
  readonly close: () => void
}

/** Build a Velite-authored prepare-conflict diagnostic for a same-key clash. */
const prepareConflictDiagnostic = (key: string): Diagnostic =>
  diagnostic('error', 'PREPARE_CONFLICT', `prepare hook declared diagnostic key '${key}' with conflicting payloads`, {
    stage: 'prepare',
    origin: { kind: 'velite' },
    provenance: { scope: 'project' },
    context: { key }
  })

/** Build a Velite-authored diagnostic for one rejected malformed declaration. */
const prepareInvalidInputDiagnostic = (reason: string): Diagnostic =>
  diagnostic('error', 'PREPARE_INVALID_INPUT', `prepare hook 'addDiagnostic' ignored a malformed input: ${reason}`, {
    stage: 'prepare',
    origin: { kind: 'velite' },
    provenance: { scope: 'project' }
  })

const VALID_LEVELS: ReadonlySet<string> = new Set(['error', 'warn', 'info'])
const ALLOWED_FIELDS: ReadonlySet<string> = new Set(['key', 'level', 'code', 'message', 'cause'])

/**
 * Validate a `PrepareDiagnosticInput` against the sole-prepare-sink shape
 * contract. Returns the rejection reason, or `undefined` when accepted.
 * Accepted when ordinary reflection reports an Object-prototype or
 * null-prototype record containing exactly own data properties `key`, `level`,
 * `code`, `message`, and optional `cause`. Unknown string keys, symbol keys,
 * accessors, inherited fields, invalid levels, or empty key/code are
 * malformed; reflection failure is malformed. No Proxy detector is used.
 */
const validatePrepareInput = (input: PrepareDiagnosticInput): string | undefined => {
  if (typeof input !== 'object' || input === null) return 'input must be an object'
  let proto: object | null
  try {
    proto = Object.getPrototypeOf(input)
  } catch {
    return 'input reflection failed'
  }
  if (proto !== null && proto !== Object.prototype) {
    return 'input must be an ordinary Object-prototype or null-prototype record'
  }
  let ownKeys: (string | symbol)[]
  try {
    ownKeys = Reflect.ownKeys(input)
  } catch {
    return 'input reflection failed'
  }
  for (const k of ownKeys) {
    if (typeof k === 'symbol') return 'input must not carry symbol keys'
    if (!ALLOWED_FIELDS.has(k)) return `unknown field '${k}'`
    const desc = Object.getOwnPropertyDescriptor(input, k)
    if (desc === undefined || 'get' in desc || 'set' in desc) {
      return `field '${k}' must be a data property, not an accessor`
    }
  }
  const key = (input as { key?: unknown }).key
  if (typeof key !== 'string' || key.length === 0) return 'key must be a non-empty string'
  const level = (input as { level?: unknown }).level
  if (typeof level !== 'string' || !VALID_LEVELS.has(level)) {
    return `level must be 'error' | 'warn' | 'info' (got '${String(level)}')`
  }
  const code = (input as { code?: unknown }).code
  if (typeof code !== 'string' || code.length === 0) return 'code must be a non-empty string'
  const message = (input as { message?: unknown }).message
  if (typeof message !== 'string') return 'message must be a string'
  return undefined
}

/**
 * Create a fresh append-only prepare diagnostic sink. The sink is single-use:
 * `close()` is called once at hook settlement, after which `addDiagnostic`
 * throws `VeliteError('internal')` and appends nothing.
 */
export const createPrepareSink = (): PrepareSink => {
  const entries = new Map<string, SinkEntry>()
  const invalid: Diagnostic[] = []
  let closed = false
  const sameCause = (a: DiagnosticValue | undefined, b: DiagnosticValue | undefined): boolean => {
    if (a === undefined && b === undefined) return true
    if (a === undefined || b === undefined) return false
    return equalDiagnosticValue(a, b)
  }
  const addDiagnostic = (raw: PrepareDiagnosticInput): void => {
    if (closed) throw new VeliteError('internal', { message: 'Prepare sink is closed — addDiagnostic called after hook settlement' })
    const rejection = validatePrepareInput(raw)
    if (rejection !== undefined) {
      // One Velite-authored error diagnostic per malformed call: fatal through
      // the ordinary gate, with nothing of the rejected input appended.
      invalid.push(prepareInvalidInputDiagnostic(rejection))
      return
    }
    const normalizedCause = raw.cause !== undefined ? normalizeDiagnosticValue(raw.cause) : undefined
    const existing = entries.get(raw.key)
    if (existing !== undefined) {
      // Exact-duplicate collapse: same level, code, message, and normalized cause.
      const samePayload =
        existing.input.level === raw.level &&
        existing.input.code === raw.code &&
        existing.input.message === raw.message &&
        sameCause(existing.normalizedCause, normalizedCause)
      if (samePayload) return
      // Same key, different normalized payload: drop both siblings and record
      // exactly one Velite-authored fatal prepare-conflict diagnostic.
      entries.delete(raw.key)
      entries.set(`__conflict__${raw.key}`, {
        input: { key: raw.key, level: 'error', code: 'PREPARE_CONFLICT', message: '' },
        normalizedCause: undefined,
        conflict: true
      })
      return
    }
    entries.set(raw.key, { input: raw, normalizedCause })
  }
  const diagnostics = (): readonly Diagnostic[] => {
    const out: Diagnostic[] = []
    for (const [, entry] of entries) {
      if (entry.conflict === true) {
        out.push(prepareConflictDiagnostic(entry.input.key))
        continue
      }
      // Construct the Diagnostic directly so the already-normalized cause is
      // not re-normalized (which would wrap the record in another record).
      const d: Diagnostic = {
        level: entry.input.level,
        code: entry.input.code,
        message: entry.input.message,
        stage: 'prepare',
        origin: { kind: 'prepare-hook', key: entry.input.key },
        provenance: { scope: 'project' },
        ...(entry.normalizedCause !== undefined ? { cause: entry.normalizedCause } : {})
      }
      out.push(d)
    }
    return [...out, ...invalid]
  }
  const close = (): void => {
    closed = true
  }
  return {
    get diagnostics() {
      return diagnostics()
    },
    addDiagnostic,
    close
  }
}
