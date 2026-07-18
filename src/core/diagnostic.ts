// Diagnostic model — the sole exported normalized diagnostic model.
//
// Authority: Ticket 23 (Complete effect and diagnostic transaction seams) —
// final concept-convergence resolution (lines 701-967). The complete exported
// surface: DiagnosticLevel, DiagnosticStage, DiagnosticOrigin, DiagnosticProvenance
// (project | collection | source | record), DiagnosticPosition, DiagnosticValue
// tagged union, Diagnostic. Total normalizer, recursive detachment, runtime
// immutability, canonical equality and ordering. No original reference, stack,
// insertion order, Promise order, object identity, host taxonomy, or dedicated
// Proxy-detection capability participates.

export type DiagnosticLevel = 'error' | 'warn' | 'info'

/** Pipeline stage that produced a diagnostic. Order is the canonical stage rank. */
export type DiagnosticStage = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch'

/** Origin of a diagnostic. */
export type DiagnosticOrigin = { readonly kind: 'core' } | { readonly kind: 'prepare-hook'; readonly key: string } | { readonly kind: 'velite' }

export interface DiagnosticCollectionProvenance {
  /** Collection order in the resolved config (non-negative safe integer). */
  readonly order: number
  /** Collection id (non-empty). */
  readonly id: string
}

export interface DiagnosticSourceProvenance {
  /** Normalized project-relative POSIX source path (non-empty). */
  readonly path: string
}

export interface DiagnosticRecordProvenance {
  /** Record source index (non-negative safe integer). */
  readonly index: number
  /** Record id (non-empty). */
  readonly id: string
}

export interface DiagnosticRequestProvenance {
  /** Request kind (non-empty). */
  readonly kind: string
  /** Stable declaration ordinal (non-negative safe integer). */
  readonly declaration: number
  /** Projection name, when applicable. */
  readonly projection?: string
  /** Stable occurrence, when applicable. */
  readonly occurrence?: import('./schema/effects').StableOccurrence
}

export type DiagnosticProvenance =
  | { readonly scope: 'project' }
  | { readonly scope: 'collection'; readonly collection: DiagnosticCollectionProvenance }
  | { readonly scope: 'source'; readonly collection?: DiagnosticCollectionProvenance; readonly source: DiagnosticSourceProvenance }
  | {
      readonly scope: 'record'
      readonly collection: DiagnosticCollectionProvenance
      readonly source: DiagnosticSourceProvenance
      readonly record: DiagnosticRecordProvenance
      readonly path?: readonly (string | number)[]
      readonly request?: DiagnosticRequestProvenance
    }

export interface DiagnosticPoint {
  readonly line?: number
  readonly column?: number
  readonly offset?: number
}

export interface DiagnosticPosition {
  readonly start: DiagnosticPoint
  readonly end?: DiagnosticPoint
}

/**
 * Narrow closed `DiagnosticValue` domain. `number` denotes only finite numbers
 * other than negative zero; exceptional numerics use the explicit number tag.
 * All unsupported host values converge to one generic opaque marker.
 */
export type DiagnosticValue =
  | null
  | boolean
  | string
  | number
  | { readonly type: 'undefined' }
  | { readonly type: 'number'; readonly value: 'negative-infinity' | 'negative-zero' | 'nan' | 'positive-infinity' }
  | { readonly type: 'bigint'; readonly value: string }
  | readonly DiagnosticValue[]
  | { readonly type: 'record'; readonly entries: readonly (readonly [string, DiagnosticValue])[] }
  | {
      readonly type: 'error'
      readonly name: string
      readonly message: string
      readonly code?: DiagnosticValue
      readonly cause?: DiagnosticValue
    }
  | { readonly type: 'circular' }
  | { readonly type: 'opaque' }

export interface Diagnostic {
  readonly level: DiagnosticLevel
  readonly code: string
  readonly message: string
  readonly stage: DiagnosticStage
  readonly origin: DiagnosticOrigin
  readonly provenance: DiagnosticProvenance
  readonly position?: DiagnosticPosition
  readonly context?: DiagnosticValue
  readonly cause?: DiagnosticValue
}

/** Build a diagnostic. */
export const diagnostic = (
  level: DiagnosticLevel,
  code: string,
  message: string,
  extra?: {
    stage?: DiagnosticStage
    origin?: DiagnosticOrigin
    provenance?: DiagnosticProvenance
    position?: DiagnosticPosition
    context?: unknown
    cause?: unknown
  }
): Diagnostic => ({
  level,
  code,
  message,
  stage: extra?.stage ?? 'schema',
  origin: extra?.origin ?? { kind: 'core' },
  provenance: extra?.provenance ?? { scope: 'project' },
  position: extra?.position,
  context: extra?.context !== undefined ? normalizeDiagnosticValue(extra.context) : undefined,
  cause: extra?.cause !== undefined ? normalizeDiagnosticValue(extra.cause) : undefined
})

// --- Total normalizer -------------------------------------------------------
//
// Authority: Ticket 23 lines 919-935. Normalization is a total operation over
// an input value. Outputs are detached and recursively runtime immutable.

const objectProto = Object.prototype
const errorProto = Error.prototype

/** Recursively freeze a normalized DiagnosticValue tree (runtime immutability). */
const freeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null) return value
  if (Array.isArray(value)) {
    for (const item of value) freeze(item)
    Object.freeze(value)
    return value
  }
  if ('type' in value && (value as { type: string }).type === 'record') {
    const rec = value as unknown as { type: 'record'; entries: (readonly [string, unknown])[] }
    for (const [, v] of rec.entries) freeze(v)
    Object.freeze(rec.entries)
    Object.freeze(rec)
    return value
  }
  if ('type' in value && (value as { type: string }).type === 'error') {
    const err = value as unknown as { type: 'error'; code?: unknown; cause?: unknown }
    if (err.code !== undefined) freeze(err.code)
    if (err.cause !== undefined) freeze(err.cause)
    Object.freeze(err)
    return value
  }
  Object.freeze(value)
  return value
}

const tagNumber = (n: number): DiagnosticValue => {
  if (Number.isNaN(n)) return { type: 'number', value: 'nan' }
  if (n === Infinity) return { type: 'number', value: 'positive-infinity' }
  if (n === -Infinity) return { type: 'number', value: 'negative-infinity' }
  if (Object.is(n, -0)) return { type: 'number', value: 'negative-zero' }
  return n
}

/**
 * Normalize an arbitrary value into the closed `DiagnosticValue` domain.
 * Total: never throws, never retains an original reference, never reads
 * `toJSON`, getters, iterators, `stack`, `constructor.name`, or host identity.
 */
export const normalizeDiagnosticValue = (input: unknown, ancestors: ReadonlySet<unknown> = new Set()): DiagnosticValue => {
  if (input === null) return null
  if (typeof input === 'boolean') return input
  if (typeof input === 'string') return input
  if (typeof input === 'number') return tagNumber(input)
  if (typeof input === 'bigint') return { type: 'bigint', value: input.toString(10) }
  if (typeof input === 'undefined') return { type: 'undefined' }
  if (typeof input === 'symbol' || typeof input === 'function') return { type: 'opaque' }
  if (typeof input === 'object') {
    if (ancestors.has(input)) return { type: 'circular' }
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(input)
    if (Array.isArray(input)) {
      const out: DiagnosticValue[] = []
      for (let i = 0; i < input.length; i++) {
        if (Object.prototype.hasOwnProperty.call(input, String(i))) {
          const descriptor = Object.getOwnPropertyDescriptor(input, String(i))
          if (descriptor !== undefined && !('get' in descriptor || 'set' in descriptor)) out.push(normalizeDiagnosticValue(descriptor.value, nextAncestors))
          else out.push({ type: 'opaque' })
        } else out.push({ type: 'undefined' })
      }
      return freeze(out)
    }
    // Error: ordinary prototype chain reaches %Error.prototype%.
    let proto: object | null
    try {
      proto = Object.getPrototypeOf(input)
    } catch {
      return { type: 'opaque' }
    }
    if (proto === errorProto || (proto !== null && Object.getPrototypeOf(proto) === errorProto) || input instanceof Error) {
      let name = 'Error'
      let p: object | null = input as object
      try {
        while (p !== null && p !== errorProto) {
          const nd = Object.getOwnPropertyDescriptor(p, 'name')
          if (nd !== undefined && !('get' in nd || 'set' in nd) && typeof nd.value === 'string') {
            name = nd.value
            break
          }
          p = Object.getPrototypeOf(p)
        }
      } catch {
        // fallthrough
      }
      let message = ''
      const md = Object.getOwnPropertyDescriptor(input, 'message')
      if (md !== undefined && !('get' in md || 'set' in md) && typeof md.value === 'string') message = md.value
      const result: {
        readonly type: 'error'
        readonly name: string
        readonly message: string
        readonly code?: DiagnosticValue
        readonly cause?: DiagnosticValue
      } = {
        type: 'error',
        name,
        message
      }
      const cd = Object.getOwnPropertyDescriptor(input, 'code')
      if (cd !== undefined && !('get' in cd || 'set' in cd)) {
        ;(result as { code?: DiagnosticValue }).code = normalizeDiagnosticValue(cd.value, nextAncestors)
      }
      const cda = Object.getOwnPropertyDescriptor(input, 'cause')
      if (cda !== undefined && !('get' in cda || 'set' in cda)) {
        ;(result as { cause?: DiagnosticValue }).cause = normalizeDiagnosticValue(cda.value, nextAncestors)
      }
      return freeze(result)
    }
    // Record: ordinary Object.prototype or null-prototype object.
    if (proto === objectProto || proto === null) {
      const entries: [string, DiagnosticValue][] = []
      for (const key of Object.keys(input)) {
        const descriptor = Object.getOwnPropertyDescriptor(input, key)
        if (descriptor === undefined || 'get' in descriptor || 'set' in descriptor) continue
        entries.push([key, normalizeDiagnosticValue(descriptor.value, nextAncestors)])
      }
      entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      return freeze({ type: 'record', entries })
    }
    return { type: 'opaque' }
  }
  return { type: 'opaque' }
}

// --- Canonical equality and ordering ---------------------------------------
//
// Authority: Ticket 23 lines 937-949.

const rank = (v: DiagnosticValue): number => {
  if (v === null) return 0
  if (typeof v === 'boolean') return 1
  if (typeof v === 'string') return 2
  if (typeof v === 'number') return 3
  if (typeof v === 'object') {
    if (!('type' in v)) return 7 // array
    switch (v.type) {
      case 'undefined':
        return 4
      case 'number':
        return 5
      case 'bigint':
        return 6
      case 'record':
        return 8
      case 'error':
        return 9
      case 'circular':
        return 10
      case 'opaque':
        return 11
    }
  }
  return 11
}

const compareNumbers = (a: number, b: number): number => a - b || (Object.is(a, -0) ? 0 : 0)

const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Compare two normalized DiagnosticValues for canonical ordering. */
export const compareDiagnosticValue = (a: DiagnosticValue, b: DiagnosticValue): number => {
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  if (a === null) return 0
  if (typeof a === 'boolean') return a === b ? 0 : a === false ? -1 : 1
  if (typeof a === 'string') return compareStrings(a, b as string)
  if (typeof a === 'number') return compareNumbers(a, b as number)
  if (typeof a === 'object') {
    if (!('type' in a)) {
      const arr = a as readonly DiagnosticValue[]
      const barr = b as readonly DiagnosticValue[]
      const len = Math.min(arr.length, barr.length)
      for (let i = 0; i < len; i++) {
        const c = compareDiagnosticValue(arr[i]!, barr[i]!)
        if (c !== 0) return c
      }
      return arr.length - barr.length
    }
    switch (a.type) {
      case 'undefined':
        return 0
      case 'number': {
        const bn = b as { readonly type: 'number'; readonly value: string }
        const order = ['negative-infinity', 'negative-zero', 'nan', 'positive-infinity']
        return order.indexOf(a.value) - order.indexOf(bn.value)
      }
      case 'bigint': {
        const bb = b as { readonly type: 'bigint'; readonly value: string }
        const an = BigInt(a.value)
        const bbn = BigInt(bb.value)
        return an < bbn ? -1 : an > bbn ? 1 : 0
      }
      case 'record': {
        const ar = a as { readonly type: 'record'; readonly entries: readonly (readonly [string, DiagnosticValue])[] }
        const br = b as { readonly type: 'record'; readonly entries: readonly (readonly [string, DiagnosticValue])[] }
        const len = Math.min(ar.entries.length, br.entries.length)
        for (let i = 0; i < len; i++) {
          const [ak, av] = ar.entries[i]!
          const [bk, bv] = br.entries[i]!
          const kc = compareStrings(ak, bk)
          if (kc !== 0) return kc
          const vc = compareDiagnosticValue(av, bv)
          if (vc !== 0) return vc
        }
        return ar.entries.length - br.entries.length
      }
      case 'error': {
        const ae = a as {
          readonly type: 'error'
          readonly name: string
          readonly message: string
          readonly code?: DiagnosticValue
          readonly cause?: DiagnosticValue
        }
        const be = b as {
          readonly type: 'error'
          readonly name: string
          readonly message: string
          readonly code?: DiagnosticValue
          readonly cause?: DiagnosticValue
        }
        const nc = compareStrings(ae.name, be.name)
        if (nc !== 0) return nc
        const mc = compareStrings(ae.message, be.message)
        if (mc !== 0) return mc
        const hasA = ae.code !== undefined
        const hasB = be.code !== undefined
        if (hasA !== hasB) return hasA ? 1 : -1
        if (hasA) {
          const cc = compareDiagnosticValue(ae.code!, be.code!)
          if (cc !== 0) return cc
        }
        const hasCa = ae.cause !== undefined
        const hasCb = be.cause !== undefined
        if (hasCa !== hasCb) return hasCa ? 1 : -1
        if (hasCa) return compareDiagnosticValue(ae.cause!, be.cause!)
        return 0
      }
      case 'circular':
      case 'opaque':
        return 0
    }
  }
  return 0
}

/** Structural equality of two normalized DiagnosticValues. */
export const equalDiagnosticValue = (a: DiagnosticValue, b: DiagnosticValue): boolean => compareDiagnosticValue(a, b) === 0

const stageRank = (s: DiagnosticStage): number => ['config', 'discover', 'load', 'schema', 'asset', 'prepare', 'output', 'watch'].indexOf(s)
const levelRank = (l: DiagnosticLevel): number => ['error', 'warn', 'info'].indexOf(l)
const originRank = (o: DiagnosticOrigin): number => (o.kind === 'core' ? 0 : o.kind === 'prepare-hook' ? 1 : 2)
const occurrenceRank = (o: import('./schema/effects').StableOccurrence | undefined): number => {
  if (o === undefined) return -1
  if (o.kind === 'singleton') return 0
  if (o.kind === 'source-index') return 1
  return 2
}

const compareProvenance = (a: DiagnosticProvenance, b: DiagnosticProvenance): number => {
  const scopeRank = (s: string): number => ['project', 'collection', 'source', 'record'].indexOf(s)
  const sa = scopeRank(a.scope)
  const sb = scopeRank(b.scope)
  if (sa !== sb) return sa - sb
  if (a.scope === 'project' && b.scope === 'project') return 0
  if (a.scope === 'collection' && b.scope === 'collection') {
    const ca = a.collection
    const cb = (b as { readonly collection: DiagnosticCollectionProvenance }).collection
    if (ca.order !== cb.order) return ca.order - cb.order
    return compareStrings(ca.id, cb.id)
  }
  if (a.scope === 'source' && b.scope === 'source') {
    const ac = a.collection
    const bc = (b as { readonly collection?: DiagnosticCollectionProvenance }).collection
    if (ac !== undefined || bc !== undefined) {
      if (ac === undefined) return -1
      if (bc === undefined) return 1
      if (ac.order !== bc.order) return ac.order - bc.order
      const cc = compareStrings(ac.id, bc.id)
      if (cc !== 0) return cc
    }
    return compareStrings(a.source.path, (b as { readonly source: DiagnosticSourceProvenance }).source.path)
  }
  // record scope
  const ar = a as {
    readonly collection: DiagnosticCollectionProvenance
    readonly source: DiagnosticSourceProvenance
    readonly record: DiagnosticRecordProvenance
    readonly path?: readonly (string | number)[]
    readonly request?: DiagnosticRequestProvenance
  }
  const br = b as typeof ar
  if (ar.collection.order !== br.collection.order) return ar.collection.order - br.collection.order
  const cc = compareStrings(ar.collection.id, br.collection.id)
  if (cc !== 0) return cc
  const sc = compareStrings(ar.source.path, br.source.path)
  if (sc !== 0) return sc
  if (ar.record.index !== br.record.index) return ar.record.index - br.record.index
  const rc = compareStrings(ar.record.id, br.record.id)
  if (rc !== 0) return rc
  // path
  const hasPa = ar.path !== undefined
  const hasPb = br.path !== undefined
  if (hasPa !== hasPb) return hasPa ? 1 : -1
  if (hasPa) {
    const ap = ar.path!
    const bp = br.path!
    const len = Math.min(ap.length, bp.length)
    for (let i = 0; i < len; i++) {
      const ai = ap[i]!
      const bi = bp[i]!
      const anum = typeof ai === 'number'
      const bnum = typeof bi === 'number'
      if (anum !== bnum) return anum ? -1 : 1
      const c = anum ? compareNumbers(ai as number, bi as number) : compareStrings(ai as string, bi as string)
      if (c !== 0) return c
    }
    const plen = ap.length - bp.length
    if (plen !== 0) return plen
  }
  // request
  const hasRa = ar.request !== undefined
  const hasRb = br.request !== undefined
  if (hasRa !== hasRb) return hasRa ? 1 : -1
  if (hasRa) {
    const areq = ar.request!
    const breq = br.request!
    const kc = compareStrings(areq.kind, breq.kind)
    if (kc !== 0) return kc
    if (areq.declaration !== breq.declaration) return areq.declaration - breq.declaration
    const hasPa2 = areq.projection !== undefined
    const hasPb2 = breq.projection !== undefined
    if (hasPa2 !== hasPb2) return hasPa2 ? 1 : -1
    if (hasPa2) {
      const pc = compareStrings(areq.projection!, breq.projection!)
      if (pc !== 0) return pc
    }
    const oa = occurrenceRank(areq.occurrence)
    const ob = occurrenceRank(breq.occurrence)
    if (oa !== ob) return oa - ob
  }
  return 0
}

const comparePosition = (a: DiagnosticPosition | undefined, b: DiagnosticPosition | undefined): number => {
  const hasA = a !== undefined
  const hasB = b !== undefined
  if (hasA !== hasB) return hasA ? 1 : -1
  if (!hasA) return 0
  const ap = a!
  const bp = b!
  // start: line, column, offset (missing coordinate before present)
  const pointCompare = (p1: DiagnosticPoint, p2: DiagnosticPoint): number => {
    const hasL1 = p1.line !== undefined
    const hasL2 = p2.line !== undefined
    if (hasL1 !== hasL2) return hasL1 ? 1 : -1
    if (hasL1) {
      const lc = (p1.line! as number) - (p2.line! as number)
      if (lc !== 0) return lc
    }
    const hasC1 = p1.column !== undefined
    const hasC2 = p2.column !== undefined
    if (hasC1 !== hasC2) return hasC1 ? 1 : -1
    if (hasC1) {
      const cc = (p1.column! as number) - (p2.column! as number)
      if (cc !== 0) return cc
    }
    const hasO1 = p1.offset !== undefined
    const hasO2 = p2.offset !== undefined
    if (hasO1 !== hasO2) return hasO1 ? 1 : -1
    if (hasO1) return (p1.offset! as number) - (p2.offset! as number)
    return 0
  }
  const sc = pointCompare(ap.start, bp.start)
  if (sc !== 0) return sc
  const hasEA = ap.end !== undefined
  const hasEB = bp.end !== undefined
  if (hasEA !== hasEB) return hasEA ? 1 : -1
  if (!hasEA) return 0
  return pointCompare(ap.end!, bp.end!)
}

/** Canonical comparison of two diagnostics. */
export const compareDiagnostic = (a: Diagnostic, b: Diagnostic): number => {
  const pc = compareProvenance(a.provenance, b.provenance)
  if (pc !== 0) return pc
  const posc = comparePosition(a.position, b.position)
  if (posc !== 0) return posc
  const src = stageRank(a.stage) - stageRank(b.stage)
  if (src !== 0) return src
  const lrc = levelRank(a.level) - levelRank(b.level)
  if (lrc !== 0) return lrc
  const orc = originRank(a.origin) - originRank(b.origin)
  if (orc !== 0) return orc
  const cc = compareStrings(a.code, b.code)
  if (cc !== 0) return cc
  const mc = compareStrings(a.message, b.message)
  if (mc !== 0) return mc
  const hasCtxA = a.context !== undefined
  const hasCtxB = b.context !== undefined
  if (hasCtxA !== hasCtxB) return hasCtxA ? 1 : -1
  if (hasCtxA) {
    const ctxc = compareDiagnosticValue(a.context!, b.context!)
    if (ctxc !== 0) return ctxc
  }
  const hasCaA = a.cause !== undefined
  const hasCaB = b.cause !== undefined
  if (hasCaA !== hasCaB) return hasCaA ? 1 : -1
  if (hasCaA) return compareDiagnosticValue(a.cause!, b.cause!)
  return 0
}

// --- VeliteError -----------------------------------------------------------

export type VeliteErrorCode = 'config' | 'discover' | 'load' | 'schema' | 'asset' | 'prepare' | 'output' | 'watch' | 'internal' | 'unknown'

interface VeliteErrorOptions<T = unknown> {
  message?: string
  context?: T
  cause?: unknown
  diagnostics?: Diagnostic[]
}

export class VeliteError<T = unknown> extends Error {
  public readonly name = 'VeliteError'
  public readonly code: VeliteErrorCode
  public readonly context?: T
  public readonly diagnostics: Diagnostic[]

  constructor(code: VeliteErrorCode, options?: VeliteErrorOptions<T>) {
    super(options?.message, options)
    this.code = code
    this.context = options?.context
    this.diagnostics = Object.freeze([...(options?.diagnostics ?? [])]) as Diagnostic[]
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

/** Whether a set of diagnostics contains at least one pipeline-level fatal error. */
export const hasFatalDiagnostic = (diagnostics: readonly Diagnostic[]): boolean => diagnostics.some(d => d.level === 'error' && d.stage !== 'schema')

/** Pick the VeliteErrorCode for a thrown build-failure VeliteError. */
export const codeFromDiagnostics = (diagnostics: readonly Diagnostic[]): VeliteErrorCode => {
  const fatal = diagnostics.find(d => d.level === 'error' && d.stage !== 'schema')
  return (fatal?.stage ?? 'unknown') as VeliteErrorCode
}

/** Throw a VeliteError. Never returns. */
export function fail(code: VeliteErrorCode, message?: string): never
export function fail<T = unknown>(code: VeliteErrorCode, options?: VeliteErrorOptions<T>): never
export function fail(code: VeliteErrorCode, options?: string | VeliteErrorOptions): never {
  throw new VeliteError(code, typeof options === 'string' ? { message: options } : options)
}

/** Whether `error` is a VeliteError. */
export const isVeliteError = (error: unknown): error is VeliteError =>
  error instanceof VeliteError || (error instanceof Error && 'code' in error && error.name === 'VeliteError')
