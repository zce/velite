// Parse-identity comparison for the record-scoped content derivation module.
//
// A pristine parse slot has the exact semantic identity:
//   (source path, selected text, dialect, effective parse profile)
// The record origin is fixed by the broker scope and need not be repeated in
// the comparison key. Rehype/recma registrations, rendering options, MDX
// compile/minify options, linked-file transforms, and projection parameters do
// NOT enter parse identity — they execute after the pristine parse and remain
// part of their branch request.
//
// Plugin functions and nested function values compare by JavaScript reference
// identity (Ticket 08 line 53). A per-epoch function-id WeakMap assigns stable
// IDs so the identity key is a string while preserving reference-identity
// semantics for functions.
//
// Internal — not exported from any public barrel.

/** The dialect atom. Markdown and MDX are distinct. */
export type Dialect = 'markdown' | 'mdx'

/**
 * Normalized effective parse-profile identity. The profile is the complete
 * effective remark registration sequence plus resolved GFM setting and every
 * other dialect/parser syntax option that can affect the pristine parse.
 *
 * Normalization is structural: a bare plugin registration and a one-element
 * plugin tuple normalize to the same registration; tuples are otherwise the
 * ordered sequence `[plugin, ...arguments]` with full recursive argument
 * participation. Plain objects normalize structurally with sorted string keys.
 * Opaque, cyclic, accessor-bearing, or non-plain-prototype values fall back to
 * reference identity. Plugin functions compare by reference identity via a
 * per-epoch WeakMap ID.
 */
export interface ProfileIdentity {
  readonly gfm: boolean | null
  readonly removeComments: boolean | null
  readonly remarkPlugins: readonly unknown[]
}

/** The full parse-identity key. */
export interface ParseIdentity {
  readonly dialect: Dialect
  readonly path: string
  readonly text: string
  readonly profile: ProfileIdentity
}

/** A per-epoch function-id map for reference-identity comparison. */
export interface ProfileNamespace {
  /** Returns a stable ID for a function reference; assigns a new one on first sight. */
  functionId(fn: (...args: unknown[]) => unknown): number
}

/** Create a fresh per-epoch profile namespace. */
export const createProfileNamespace = (): ProfileNamespace => {
  const map = new WeakMap<object, number>()
  let next = 1
  return {
    functionId(fn: (...args: unknown[]) => unknown): number {
      const existing = map.get(fn as object)
      if (existing !== undefined) return existing
      const id = next++
      map.set(fn as object, id)
      return id
    }
  }
}

/** Build a structural identity key from a value (opaque/cyclic → reference identity). */
const normalizeValue = (value: unknown, seen: WeakMap<object, true>, functionId: (fn: object) => number): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return `b:${value}`
  if (typeof value === 'number') return `n:${Object.is(value, -0) ? '-0' : String(value)}`
  if (typeof value === 'bigint') return `bi:${String(value)}`
  if (typeof value === 'string') return `s:${value.length}:${value}`
  if (typeof value === 'symbol') return `sym:${String(value)}`
  if (typeof value === 'function') return `fn#${functionId(value as object)}`
  if (typeof value !== 'object') return String(value)
  const obj = value as object
  if (seen.has(obj)) return 'cyclic'
  seen.set(obj, true)
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return `ref#${functionId(obj)}`
  let descriptorIssues = false
  const keys: string[] = []
  for (const key of Object.keys(obj)) {
    const desc = Object.getOwnPropertyDescriptor(obj, key)
    if (desc === undefined || desc.get !== undefined || desc.set !== undefined || !desc.enumerable) {
      descriptorIssues = true
      break
    }
    keys.push(key)
  }
  if (descriptorIssues) return `ref#${functionId(obj)}`
  keys.sort()
  const parts = keys.map(k => `${k}:${normalizeValue((obj as Record<string, unknown>)[k], seen, functionId)}`)
  return `o{${parts.join(',')}}`
}

/** Normalize a remark plugin tuple to a stable structural key. */
const normalizePlugin = (entry: unknown, functionId: (fn: object) => number): string => {
  if (Array.isArray(entry)) {
    if (entry.length === 0) return 'tuple:empty'
    const [plugin, ...args] = entry
    if (args.length === 0) return normalizePlugin(plugin, functionId)
    const pluginKey = typeof plugin === 'function' ? `fn#${functionId(plugin as object)}` : normalizeValue(plugin, new WeakMap(), functionId)
    const argsKey = args.map(a => normalizeValue(a, new WeakMap(), functionId)).join(',')
    return `tuple(${pluginKey},[${argsKey}])`
  }
  if (typeof entry === 'function') return `fn#${functionId(entry as object)}`
  return normalizeValue(entry, new WeakMap(), functionId)
}

/** Compute the normalized identity key string for a profile. */
const profileKey = (profile: ProfileIdentity, functionId: (fn: object) => number): string =>
  `gfm=${profile.gfm}|rc=${profile.removeComments}|remark=[${profile.remarkPlugins.map(p => normalizePlugin(p, functionId)).join(';')}]`

/** Compute the composite identity key used to index broker slots. */
export const parseIdentityKey = (id: ParseIdentity, namespace?: ProfileNamespace): string => {
  const fid = namespace === undefined ? fallbackFunctionId : (fn: object) => namespace.functionId(fn as (...args: unknown[]) => unknown)
  return `${id.dialect}|${id.path}|${id.text.length}:${id.text}|${profileKey(id.profile, fid)}`
}

/** Fallback function-id using reference identity (stable per process). */
const fallbackFunctionId = (fn: object): number => {
  const existing = fallbackIds.get(fn)
  if (existing !== undefined) return existing
  const id = fallbackNext++
  fallbackIds.set(fn, id)
  return id
}
const fallbackIds = new WeakMap<object, number>()
let fallbackNext = 1

/** Resolve an effective profile identity from a raw profile object. */
export const resolveProfileIdentity = (profile: unknown): ProfileIdentity => {
  if (profile == null || typeof profile !== 'object') return { gfm: null, removeComments: null, remarkPlugins: [] }
  const p = profile as { gfm?: boolean; removeComments?: boolean; remarkPlugins?: unknown[] }
  return {
    gfm: typeof p.gfm === 'boolean' ? p.gfm : null,
    removeComments: typeof p.removeComments === 'boolean' ? p.removeComments : null,
    remarkPlugins: Array.isArray(p.remarkPlugins) ? p.remarkPlugins.slice() : []
  }
}

/** Build a {@link ParseIdentity} from the raw broker request inputs. */
export const buildParseIdentity = (dialect: Dialect, path: string, text: string, profile: unknown): ParseIdentity => ({
  dialect,
  path,
  text,
  profile: resolveProfileIdentity(profile)
})

/** Exact structural equality between two parse identities. */
export const identityEquals = (a: ParseIdentity, b: ParseIdentity, namespace?: ProfileNamespace): boolean =>
  parseIdentityKey(a, namespace) === parseIdentityKey(b, namespace)
