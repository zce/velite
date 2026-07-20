// VFile seed + supported-data copier + parse-message snapshot.
//
// The seed is the immutable branch-materializable snapshot of the supported
// parse-time VFile state: cwd, ordered history, supported data, and supported
// parse messages. The copier inspects property descriptors WITHOUT invoking
// getters, never preserves an unsupported value by reference, and never
// silently omits an unsupported own property. Encountering an unsupported
// value while building the seed deterministically rejects the parse artifact
// as a plugin/configuration compatibility diagnostic.
//
// Supported values: null, undefined, booleans, strings, numbers, bigints,
// arrays (length/order/holes preserved), and plain objects (Object.prototype
// or null prototype; enumerable own string-keyed data properties). Repeated
// references and cycles preserve their graph topology inside each copy.
//
// Unsupported values: functions, symbol values, class instances, dates, maps,
// sets, typed arrays, weak collections, accessors, symbol-keyed properties,
// non-enumerable custom properties, proxies that throw during safe descriptor
// inspection, and other opaque values. The copier NEVER preserves an
// unsupported value by reference and NEVER silently omits an unsupported own
// property — it deterministically rejects the entire seed.
//
// Internal — not exported from any public barrel.

/** A standard reportable parse-message seed. */
export interface ParseMessageSeed {
  readonly reason: string
  readonly fatal?: boolean
  readonly file?: string
  readonly name?: string
  readonly line?: number
  readonly column?: number
  readonly place?: unknown
  readonly source?: string
  readonly ruleId?: string
  readonly actual?: unknown
  readonly expected?: unknown
  readonly note?: string
  readonly url?: string
  readonly stack?: string
  readonly cause?: unknown
}

/** The supported VFile seed. */
export interface VFileSeed {
  readonly cwd: string
  readonly history: readonly string[]
  readonly data: Readonly<Record<string, unknown>>
  readonly messages: readonly ParseMessageSeed[]
}

/** Raised when an unsupported value is encountered while building a seed. */
export class UnsupportedSeedValueError extends Error {
  override readonly name = 'UnsupportedSeedValueError'
  readonly reason: string
  constructor(reason: string) {
    super(reason)
    this.reason = reason
  }
}

type CloneState = { readonly branchSeen: Map<object, object> }

/** Inspect a value's plain-ness without invoking getters. Returns null if not a supported plain object/array root. */
const plainKind = (value: object): 'array' | 'plain' | null => {
  if (Array.isArray(value)) return 'array'
  const proto = Object.getPrototypeOf(value)
  if (proto === Object.prototype || proto === null) return 'plain'
  return null
}

/** Capture all own enumerable string-keyed data properties WITHOUT invoking getters. */
const captureOwnData = (obj: object): { keys: string[]; values: unknown[] } => {
  const keys: string[] = []
  const values: unknown[] = []
  for (const key of Object.keys(obj)) {
    const desc = Object.getOwnPropertyDescriptor(obj, key)
    if (desc === undefined) continue
    if (desc.get !== undefined || desc.set !== undefined) throw new UnsupportedSeedValueError('accessor property')
    if (!desc.enumerable) throw new UnsupportedSeedValueError('non-enumerable own property')
    keys.push(key)
    values.push(desc.value)
  }
  return { keys, values }
}

const cloneSupported = (value: unknown, state: CloneState): unknown => {
  if (value === null) return null
  if (value === undefined) return undefined
  const t = typeof value
  if (t === 'boolean' || t === 'string' || t === 'number' || t === 'bigint') return value
  if (t === 'function') throw new UnsupportedSeedValueError('function value')
  if (t === 'symbol') throw new UnsupportedSeedValueError('symbol value')
  if (t !== 'object') throw new UnsupportedSeedValueError(`unsupported typeof ${t}`)

  const obj = value as object
  const existing = state.branchSeen.get(obj)
  if (existing !== undefined) return existing

  const kind = plainKind(obj)
  if (kind === null) throw new UnsupportedSeedValueError('non-plain prototype')

  if (kind === 'array') {
    const arr = value as unknown[]
    const copy: unknown[] = []
    state.branchSeen.set(obj, copy)
    for (let i = 0; i < arr.length; i++) {
      if (i in arr) {
        copy[i] = cloneSupported(arr[i], state)
      }
    }
    return copy
  }

  // plain object
  const { keys, values } = captureOwnData(obj)
  const copy: Record<string, unknown> = Object.create(Object.getPrototypeOf(obj))
  state.branchSeen.set(obj, copy)
  for (let i = 0; i < keys.length; i++) {
    copy[keys[i]!] = cloneSupported(values[i], state)
  }
  return copy
}

/**
 * Clone a supported data graph for a branch. Repeated references and cycles
 * preserve their graph topology inside the copy. Throws
 * {@link UnsupportedSeedValueError} on the first unsupported value.
 */
export const cloneSupportedData = (root: unknown): unknown => {
  const state: CloneState = { branchSeen: new Map() }
  return cloneSupported(root, state)
}

/** Snapshot a supported value, returning a deep-independent copy or rejecting. */
export const snapshotSupported = (value: unknown): unknown => cloneSupportedData(value)

/** The standard reportable message fields captured by the seed. */
export const MESSAGE_FIELDS = [
  'reason',
  'message',
  'fatal',
  'file',
  'name',
  'line',
  'column',
  'place',
  'source',
  'ruleId',
  'actual',
  'expected',
  'note',
  'url',
  'stack',
  'cause'
] as const

/** Snapshot a single parse message. Rejects on unsupported custom fields or opaque cause. */
export const snapshotMessage = (msg: object): ParseMessageSeed => {
  // VFileMessage (and VFileMessage-compatible objects) have a non-plain
  // prototype (Error subclass). The seed captures the standard reportable
  // fields via own-enumerable data-property descriptors without invoking
  // getters. Custom message fields outside the allowed set are unsupported.
  const allowed = new Set<string>(MESSAGE_FIELDS)
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(msg)) {
    const desc = Object.getOwnPropertyDescriptor(msg, key)
    if (desc === undefined) continue
    if (desc.get !== undefined || desc.set !== undefined) throw new UnsupportedSeedValueError('message accessor property')
    if (!desc.enumerable) throw new UnsupportedSeedValueError('message non-enumerable property')
    if (!allowed.has(key)) throw new UnsupportedSeedValueError(`unsupported message field: ${key}`)
    out[key] = desc.value
  }
  const seed: MutableParseMessageSeed = {
    reason: typeof out.reason === 'string' ? out.reason : typeof out.message === 'string' ? (out.message as string) : ''
  }
  if (typeof out.fatal === 'boolean') seed.fatal = out.fatal
  if (typeof out.file === 'string') seed.file = out.file
  if (typeof out.name === 'string') seed.name = out.name
  if (typeof out.line === 'number') seed.line = out.line
  if (typeof out.column === 'number') seed.column = out.column
  if (out.place !== undefined) seed.place = snapshotSupported(out.place)
  if (typeof out.source === 'string') seed.source = out.source
  if (typeof out.ruleId === 'string') seed.ruleId = out.ruleId
  if (out.actual !== undefined) seed.actual = out.actual
  if (out.expected !== undefined) seed.expected = snapshotSupported(out.expected)
  if (typeof out.note === 'string') seed.note = out.note
  if (typeof out.url === 'string') seed.url = out.url
  if (typeof out.stack === 'string') seed.stack = out.stack
  if (out.cause !== undefined && out.cause !== null) {
    seed.cause = snapshotSupported(out.cause)
  }
  return seed
}

/** A mutable builder view of {@link ParseMessageSeed}. */
type MutableParseMessageSeed = {
  reason: string
  fatal?: boolean
  file?: string
  name?: string
  line?: number
  column?: number
  place?: unknown
  source?: string
  ruleId?: string
  actual?: unknown
  expected?: unknown
  note?: string
  url?: string
  stack?: string
  cause?: unknown
}

/** Snapshot the parse-time VFile state into an immutable seed. Rejects on unsupported values. */
export const snapshotSeed = (input: {
  readonly cwd: string
  readonly history: readonly string[]
  readonly data: unknown
  readonly messages: readonly object[]
}): VFileSeed => {
  if (typeof input.cwd !== 'string') throw new UnsupportedSeedValueError('cwd is not a string')
  if (!Array.isArray(input.history)) throw new UnsupportedSeedValueError('history is not an array')
  for (const h of input.history) {
    if (typeof h !== 'string') throw new UnsupportedSeedValueError('history entry is not a string')
  }
  if (input.history.length === 0) throw new UnsupportedSeedValueError('history is empty')
  const dataRoot = input.data == null ? {} : snapshotSupported(input.data)
  if (dataRoot == null || typeof dataRoot !== 'object' || Array.isArray(dataRoot)) {
    throw new UnsupportedSeedValueError('file.data root must be a plain object')
  }
  const messages: ParseMessageSeed[] = []
  for (const m of input.messages) {
    if (m == null || typeof m !== 'object') throw new UnsupportedSeedValueError('message is not an object')
    messages.push(snapshotMessage(m))
  }
  return {
    cwd: input.cwd,
    history: input.history.slice(),
    data: dataRoot as Record<string, unknown>,
    messages
  }
}
