// Test-owned Diagnostic/DiagnosticValue oracle. An INDEPENDENT implementation
// of the normalization, equality, and ordering rules per Ticket 23 lines
// 701-967. Tests import THIS, not the production normalizer, so the oracle
// cross-checks production output without sharing code.

export type TestDiagnosticValue =
  | null
  | boolean
  | string
  | number
  | { readonly type: 'undefined' }
  | { readonly type: 'number'; readonly value: 'negative-infinity' | 'negative-zero' | 'nan' | 'positive-infinity' }
  | { readonly type: 'bigint'; readonly value: string }
  | readonly TestDiagnosticValue[]
  | { readonly type: 'record'; readonly entries: readonly (readonly [string, TestDiagnosticValue])[] }
  | {
      readonly type: 'error'
      readonly name: string
      readonly message: string
      readonly code?: TestDiagnosticValue
      readonly cause?: TestDiagnosticValue
    }
  | { readonly type: 'circular' }
  | { readonly type: 'opaque' }

const objectProto = Object.prototype
const errorProto = Error.prototype

const tagNumber = (n: number): TestDiagnosticValue => {
  if (Number.isNaN(n)) return { type: 'number', value: 'nan' }
  if (n === Infinity) return { type: 'number', value: 'positive-infinity' }
  if (n === -Infinity) return { type: 'number', value: 'negative-infinity' }
  if (Object.is(n, -0)) return { type: 'number', value: 'negative-zero' }
  return n
}

/** Independent normalization — does NOT import production code. */
export const oracleNormalize = (input: unknown, ancestors: ReadonlySet<unknown> = new Set()): TestDiagnosticValue => {
  if (input === null) return null
  if (typeof input === 'boolean') return input
  if (typeof input === 'string') return input
  if (typeof input === 'number') return tagNumber(input)
  if (typeof input === 'bigint') return { type: 'bigint', value: input.toString(10) }
  if (typeof input === 'undefined') return { type: 'undefined' }
  if (typeof input === 'symbol' || typeof input === 'function') return { type: 'opaque' }
  if (typeof input === 'object') {
    if (ancestors.has(input)) return { type: 'circular' }
    const next = new Set(ancestors)
    next.add(input)
    if (Array.isArray(input)) {
      const out: TestDiagnosticValue[] = []
      for (let i = 0; i < input.length; i++) {
        const d = Object.getOwnPropertyDescriptor(input, String(i))
        if (d !== undefined && !('get' in d || 'set' in d) && i in input) out.push(oracleNormalize(d.value, next))
        else if (d !== undefined && ('get' in d || 'set' in d)) out.push({ type: 'opaque' })
        else out.push({ type: 'undefined' })
      }
      return out
    }
    let proto: object | null
    try {
      proto = Object.getPrototypeOf(input)
    } catch {
      return { type: 'opaque' }
    }
    if (input instanceof Error || proto === errorProto) {
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
      const md = Object.getOwnPropertyDescriptor(input, 'message')
      const message = md !== undefined && !('get' in md || 'set' in md) && typeof md.value === 'string' ? md.value : ''
      const out: { type: 'error'; name: string; message: string; code?: TestDiagnosticValue; cause?: TestDiagnosticValue } = { type: 'error', name, message }
      const cd = Object.getOwnPropertyDescriptor(input, 'code')
      if (cd !== undefined && !('get' in cd || 'set' in cd)) out.code = oracleNormalize(cd.value, next)
      const cda = Object.getOwnPropertyDescriptor(input, 'cause')
      if (cda !== undefined && !('get' in cda || 'set' in cda)) out.cause = oracleNormalize(cda.value, next)
      return out
    }
    if (proto === objectProto || proto === null) {
      const entries: [string, TestDiagnosticValue][] = []
      for (const key of Object.keys(input)) {
        const d = Object.getOwnPropertyDescriptor(input, key)
        if (d === undefined || 'get' in d || 'set' in d) continue
        entries.push([key, oracleNormalize(d.value, next)])
      }
      entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      return { type: 'record', entries }
    }
    return { type: 'opaque' }
  }
  return { type: 'opaque' }
}

const rank = (v: TestDiagnosticValue): number => {
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

const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Independent canonical comparison. */
export const oracleCompare = (a: TestDiagnosticValue, b: TestDiagnosticValue): number => {
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  if (a === null) return 0
  if (typeof a === 'boolean') return a === b ? 0 : a === false ? -1 : 1
  if (typeof a === 'string') return compareStrings(a, b as string)
  if (typeof a === 'number') return a - (b as number) || 0
  if (typeof a === 'object') {
    if (!('type' in a)) {
      const arr = a as readonly TestDiagnosticValue[]
      const barr = b as readonly TestDiagnosticValue[]
      const len = Math.min(arr.length, barr.length)
      for (let i = 0; i < len; i++) {
        const c = oracleCompare(arr[i]!, barr[i]!)
        if (c !== 0) return c
      }
      return arr.length - barr.length
    }
    switch (a.type) {
      case 'undefined':
        return 0
      case 'number': {
        const order = ['negative-infinity', 'negative-zero', 'nan', 'positive-infinity']
        return order.indexOf(a.value) - order.indexOf((b as { type: 'number'; value: string }).value)
      }
      case 'bigint': {
        const an = BigInt(a.value)
        const bn = BigInt((b as { type: 'bigint'; value: string }).value)
        return an < bn ? -1 : an > bn ? 1 : 0
      }
      case 'record': {
        const ar = (a as { type: 'record'; entries: readonly (readonly [string, TestDiagnosticValue])[] }).entries
        const br = (b as { type: 'record'; entries: readonly (readonly [string, TestDiagnosticValue])[] }).entries
        const len = Math.min(ar.length, br.length)
        for (let i = 0; i < len; i++) {
          const [ak, av] = ar[i]!
          const [bk, bv] = br[i]!
          const kc = compareStrings(ak, bk)
          if (kc !== 0) return kc
          const vc = oracleCompare(av, bv)
          if (vc !== 0) return vc
        }
        return ar.length - br.length
      }
      case 'error': {
        const ae = a as { type: 'error'; name: string; message: string; code?: TestDiagnosticValue; cause?: TestDiagnosticValue }
        const be = b as { type: 'error'; name: string; message: string; code?: TestDiagnosticValue; cause?: TestDiagnosticValue }
        const nc = compareStrings(ae.name, be.name)
        if (nc !== 0) return nc
        const mc = compareStrings(ae.message, be.message)
        if (mc !== 0) return mc
        const hasAC = ae.code !== undefined
        const hasBC = be.code !== undefined
        if (hasAC !== hasBC) return hasAC ? 1 : -1
        if (hasAC) {
          const cc = oracleCompare(ae.code!, be.code!)
          if (cc !== 0) return cc
        }
        const hasACa = ae.cause !== undefined
        const hasBCa = be.cause !== undefined
        if (hasACa !== hasBCa) return hasACa ? 1 : -1
        if (hasACa) return oracleCompare(ae.cause!, be.cause!)
        return 0
      }
      case 'circular':
      case 'opaque':
        return 0
    }
  }
  return 0
}

export const oracleEqual = (a: TestDiagnosticValue, b: TestDiagnosticValue): boolean => oracleCompare(a, b) === 0
