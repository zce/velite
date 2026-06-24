// src/core/engine/engine.ts
import { hash } from '../util/hash'

import type { Context } from './context'
import type { Dependency } from './memo'

export type Revision = number
export type InputId = string

/**
 * A pure, memoized computation. Identified by `name` (must be unique per
 * engine). Given a key, it derives a value, reading any other inputs/derivations
 * through the injected {@link Context}. The same key must always recompute to an
 * equal value for equal dependency values — this is what makes incremental
 * rebuilds equivalent to full builds.
 */
export interface Derivation<K, V> {
  readonly name: string
  /** Serialize a key into a stable string. Defaults to identity/JSON. */
  key?(key: K): string
  compute(context: Context, key: K): V | Promise<V>
  /** Digest a value for equality checks (enables backdating). Defaults to JSON hash. */
  hash?(value: V): string
}

export interface Engine {
  /** The current global revision. Bumps whenever an input value changes. */
  readonly revision: Revision
  /** Set an external input. No-op if the value is unchanged. */
  set<V>(id: InputId, value: V): void
  /** Remove an external input. Invalidates anything that depended on it. */
  remove(id: InputId): void
  /** Demand a derivation's value, computing or reusing memo as needed. */
  get<K, V>(derivation: Derivation<K, V>, key: K): Promise<V>
  /** Drop memo entries not demanded within the last `keepWithin` revisions. */
  gc(keepWithin: Revision): void
}

/**
 * Thrown by the engine for invariant violations: dependency cycles and reads of
 * unset inputs. M1 leaves this as a native engine error; M2's driver boundary
 * translates it into a `VeliteError`.
 */
export class EngineError extends Error {
  constructor(
    readonly code: 'cycle' | 'missing-input',
    message: string
  ) {
    super(message)
    this.name = 'EngineError'
  }
}

interface InputSlot {
  value: unknown
  hash: string
  changedAt: Revision
}

interface Entry {
  derivation: Derivation<unknown, unknown>
  key: unknown
  value: unknown
  hash: string
  deps: Dependency[]
  verifiedAt: Revision
  changedAt: Revision
  lastUsed: Revision
  stale: boolean
}

const KEY_SEPARATOR = '\0'

const defaultKey = (key: unknown): string => JSON.stringify(key) ?? 'undefined'

const hashValue = (value: unknown): string => hash(value instanceof Uint8Array ? value : (JSON.stringify(value) ?? 'undefined'))

export const createEngine = (): Engine => {
  const inputs = new Map<InputId, InputSlot>()
  const memos = new Map<string, Entry>()
  const reverseDeps = new Map<string, Set<string>>()
  const running = new Map<string, Promise<unknown>>()
  let revision: Revision = 0

  const memoKeyOf = (derivation: Derivation<unknown, unknown>, key: unknown): string => derivation.name + KEY_SEPARATOR + (derivation.key ?? defaultKey)(key)

  const digestOf = (derivation: Derivation<unknown, unknown>, value: unknown): string => (derivation.hash ? derivation.hash(value) : hashValue(value))

  const tokenOf = (dep: Dependency): string => (dep.kind === 'input' ? 'i' + dep.id : 'd' + dep.memoKey)

  const markStale = (token: string): void => {
    const dependents = reverseDeps.get(token)
    if (dependents === undefined) return
    for (const memoKey of dependents) {
      const entry = memos.get(memoKey)
      if (entry === undefined || entry.stale) continue
      entry.stale = true
      markStale('d' + memoKey)
    }
  }

  const replaceDeps = (memoKey: string, entry: Entry, deps: Dependency[]): void => {
    for (const dep of entry.deps) {
      const token = tokenOf(dep)
      const dependents = reverseDeps.get(token)
      if (dependents === undefined) continue
      dependents.delete(memoKey)
      if (dependents.size === 0) reverseDeps.delete(token)
    }
    for (const dep of deps) {
      const token = tokenOf(dep)
      let dependents = reverseDeps.get(token)
      if (dependents === undefined) {
        dependents = new Set()
        reverseDeps.set(token, dependents)
      }
      dependents.add(memoKey)
    }
    entry.deps = deps
  }

  const set = <V>(id: InputId, value: V): void => {
    const digest = hashValue(value)
    const prev = inputs.get(id)
    if (prev && prev.hash === digest) return
    revision++
    inputs.set(id, { value, hash: digest, changedAt: revision })
    markStale('i' + id)
  }

  const remove = (id: InputId): void => {
    if (!inputs.delete(id)) return
    revision++
    markStale('i' + id)
  }

  /** Whether any tracked dependency of `entry` changed since it was verified. */
  const isDirty = async (entry: Entry, stack: Set<string>): Promise<boolean> => {
    for (const dep of entry.deps) {
      if (dep.kind === 'input') {
        const slot = inputs.get(dep.id)
        if (slot === undefined) {
          if (dep.missing) continue
          return true
        }
        if (dep.missing || slot.changedAt > entry.verifiedAt) return true
      } else {
        const depEntry = memos.get(dep.memoKey)
        if (depEntry === undefined) return true
        if (depEntry.stale) await demand(depEntry.derivation, depEntry.key, stack)
        const refreshed = memos.get(dep.memoKey)
        if (refreshed === undefined || refreshed.changedAt > entry.verifiedAt) return true
      }
    }
    return false
  }

  const recompute = async (memoKey: string, entry: Entry, computeStack: Set<string>, isFirst: boolean): Promise<void> => {
    const deps: Dependency[] = []
    const seen = new Set<string>()
    const record = (token: string, dep: Dependency): void => {
      if (seen.has(token)) return
      seen.add(token)
      deps.push(dep)
    }
    const context: Context = {
      get: (derivation, key) => {
        const memoKey = memoKeyOf(derivation as Derivation<unknown, unknown>, key)
        record('d' + memoKey, { kind: 'derivation', memoKey })
        return demand(derivation as Derivation<unknown, unknown>, key, computeStack) as Promise<never>
      },
      input: <V>(id: InputId): V => {
        const slot = inputs.get(id)
        record('i' + id, { kind: 'input', id, missing: slot === undefined })
        if (slot === undefined) throw new EngineError('missing-input', `input not set: ${id}`)
        return slot.value as V
      }
    }

    const value = await entry.derivation.compute(context, entry.key)
    const digest = digestOf(entry.derivation, value)
    if (isFirst || digest !== entry.hash) entry.changedAt = revision
    entry.value = value
    entry.hash = digest
    replaceDeps(memoKey, entry, deps)
    entry.verifiedAt = revision
    entry.lastUsed = revision
    entry.stale = false
  }

  const evaluate = async (derivation: Derivation<unknown, unknown>, key: unknown, memoKey: string, stack: Set<string>): Promise<unknown> => {
    const childStack = new Set(stack).add(memoKey)
    const existing = memos.get(memoKey)
    if (existing === undefined) {
      const entry: Entry = {
        derivation,
        key,
        value: undefined,
        hash: '',
        deps: [],
        verifiedAt: 0,
        changedAt: 0,
        lastUsed: revision,
        stale: false
      }
      memos.set(memoKey, entry)
      try {
        await recompute(memoKey, entry, childStack, true)
      } catch (err) {
        memos.delete(memoKey)
        throw err
      }
      return entry.value
    }
    existing.lastUsed = revision
    if (existing.verifiedAt === revision) return existing.value
    if (existing.stale && (await isDirty(existing, childStack))) {
      await recompute(memoKey, existing, childStack, false)
    } else {
      existing.verifiedAt = revision
      existing.stale = false
    }
    return existing.value
  }

  const demand = (derivation: Derivation<unknown, unknown>, key: unknown, stack: Set<string>): Promise<unknown> => {
    const memoKey = memoKeyOf(derivation, key)
    if (stack.has(memoKey)) {
      return Promise.reject(new EngineError('cycle', `dependency cycle at ${memoKey}`))
    }
    const inflight = running.get(memoKey)
    if (inflight !== undefined) return inflight
    const promise = evaluate(derivation, key, memoKey, stack)
    running.set(memoKey, promise)
    return promise.finally(() => {
      if (running.get(memoKey) === promise) running.delete(memoKey)
    })
  }

  const gc = (keepWithin: Revision): void => {
    for (const [memoKey, entry] of memos) {
      if (revision - entry.lastUsed > keepWithin) memos.delete(memoKey)
    }
  }

  return {
    get revision() {
      return revision
    },
    set,
    remove,
    get: <K, V>(derivation: Derivation<K, V>, key: K) => demand(derivation as Derivation<unknown, unknown>, key, new Set()) as Promise<V>,
    gc
  }
}
