// Schema effects — the collect → validate → commit model for cross-file state.
//
// Authority: Ticket 23 (Complete effect and diagnostic transaction seams) —
// final concept-convergence resolution. Effects are owner- and provenance-
// bearing declarative facts promoted through branch, valid-record, cross-file-
// valid, and committed-generation transactions. Custom declarations provide a
// record-rooted semantic path, stable declaration ordinal, and one validated
// stable occurrence; Velite supplies system owner/source provenance. Call
// order, append order, visitation counters, cache hits, Promise completion,
// and object identity are forbidden identity and ordering sources.
//
// Custom occurrence is exactly `singleton`, `source-index`, or `key`. Velite-
// controlled roots and projections may retain a private authoritative half-
// open source range; that private representation is not a member of
// StableOccurrence, not accepted by custom collectEffect, not exported, and
// not treated as a custom selected-input claim.

/** A stable occurrence kind for a custom effect declaration. */
export type StableOccurrence =
  | { readonly kind: 'singleton' }
  | { readonly kind: 'source-index'; readonly index: number }
  | { readonly kind: 'key'; readonly key: string }

/** Context supplied by Velite when a custom schema declares an effect. */
export interface EffectDeclarationContext {
  /** Record-rooted semantic declaration path (string segments non-empty). */
  readonly path: readonly (string | number)[]
  /** Stable declaration ordinal (non-negative safe integer). */
  readonly declaration: number
  /** One validated stable occurrence. */
  readonly occurrence: StableOccurrence
}

/** A uniqueness registration effect produced by `s.unique()`/`s.slug()`. */
export interface UniqueEffectDeclaration {
  readonly type: 'unique'
  readonly group: string
  readonly value: string
}

/** An asset reference effect produced by `s.file()`/`s.image()`. */
export interface AssetReferenceEffectDeclaration {
  readonly type: 'asset'
  readonly source: string
  readonly output: {
    readonly base: string
    readonly template: string
  }
  readonly metadata: boolean
  readonly blur?: {
    readonly width?: number
    readonly height?: number
    readonly quality?: number
  }
}

/** A custom effect declaration accepted by `SchemaContext.collectEffect`. */
export type SchemaEffectDeclaration = UniqueEffectDeclaration | AssetReferenceEffectDeclaration

// --- Internal committed effect representation (not public surface) ----------
//
// The committed `Effect` carries Velite-supplied system provenance (owner,
// collection order/identity, source-file identity, record source index/identity,
// request provenance when applicable) plus the caller-declared semantic
// payload. Exact effect duplicates collapse only by kind, system owner,
// complete effective provenance, and normalized semantic payload. Canonical
// effect order compares collection order/identity, source path, record source
// index/identity, semantic path, declaration, occurrence, controlled private
// request/source locator when applicable, kind, and normalized payload.

/** Velite-supplied system owner for an effect. */
export interface EffectSystemOwner {
  /** Owning record id (`sourceId#key` or `sourceId#index`). */
  readonly owner: string
  /** Collection order (non-negative safe integer). */
  readonly collectionOrder: number
  /** Collection id (non-empty). */
  readonly collectionId: string
  /** Source path (normalized project-relative POSIX). */
  readonly sourcePath: string
  /** Record source index (non-negative safe integer). */
  readonly recordIndex: number
  /** Record id (non-empty). */
  readonly recordId: string
}

/** Velite-supplied request provenance, when applicable. */
export interface EffectRequestProvenance {
  readonly kind: string
  readonly declaration: number
  readonly projection?: string
  readonly occurrence?: StableOccurrence
  /** Private authoritative half-open source range `[start, end)`, when present. */
  readonly sourceRange?: { readonly start: number; readonly end: number }
}

/** A committed unique effect. */
export interface UniqueEffect {
  readonly type: 'unique'
  /** @deprecated use system.owner — retained during Phase 1-3 migration. */
  readonly owner: string
  readonly group: string
  readonly value: string
  readonly system?: EffectSystemOwner
  readonly request?: EffectRequestProvenance
}

/** A committed asset reference effect. */
export interface AssetReferenceEffect {
  readonly type: 'asset'
  /** @deprecated use system.owner — retained during Phase 1-3 migration. */
  readonly owner: string
  readonly assetPath: string
  readonly publicUrl: string
  readonly resolved: boolean
  readonly isImage: boolean
  readonly system?: EffectSystemOwner
  readonly request?: EffectRequestProvenance
}

/** A committed effect with full Velite-supplied provenance. */
export type Effect = UniqueEffect | AssetReferenceEffect

// --- Back-compat: the internal committed index used by the pipeline ----------
//
// `createEffectIndex` retains its pre-1.0 interface for now; Phase 3 will
// replace it with the record-atomic effect transaction and canonical ordering.

/**
 * Immutable-ish index of committed schema effects, keyed by owner.
 *
 * `apply` mutates the committed index (used after a successful build run).
 * `patch` returns a *candidate* index without mutating this one: it removes the
 * given owners' effects and applies a new batch, yielding the would-be live
 * state for validation.
 */
export interface EffectIndex {
  /** Commit effects to this index. */
  apply(effects: readonly Effect[]): void
  /** Build a candidate index with `ownersToRemove` dropped and `newEffects` added. */
  patch(ownersToRemove: readonly string[], newEffects: readonly Effect[]): EffectIndex
  /**
   * Find the owner that has registered a unique `value` in `group`, excluding
   * `owner` itself. Returns the conflicting owner or `undefined`.
   */
  findUniqueConflict(group: string, value: string, owner: string): string | undefined
  /** All asset references recorded by `owner`. */
  assetReferencesOf(owner: string): readonly AssetReferenceEffect[]
}

const UNIQUE_SEP = ' '

export const createEffectIndex = (initial?: ReadonlyMap<string, Effect[]>): EffectIndex => {
  const byOwner = new Map<string, Effect[]>(initial ? Array.from(initial, ([k, v]) => [k, [...v]]) : [])
  let uniqueLookup: Map<string, string> | undefined

  const unique = (): Map<string, string> => {
    if (uniqueLookup == null) {
      const map = new Map<string, string>()
      for (const [owner, effects] of byOwner) {
        for (const e of effects) {
          if (e.type === 'unique') map.set(`${e.group}${UNIQUE_SEP}${e.value}`, owner)
        }
      }
      uniqueLookup = map
    }
    return uniqueLookup
  }

  return {
    apply(effects) {
      uniqueLookup = undefined
      for (const e of effects) {
        const ownerKey = e.system?.owner ?? e.owner
        const list = byOwner.get(ownerKey)
        if (list == null) byOwner.set(ownerKey, [e])
        else list.push(e)
      }
    },

    patch(ownersToRemove, newEffects) {
      const next = new Map(byOwner)
      for (const owner of ownersToRemove) next.delete(owner)
      const candidate = createEffectIndex(next)
      candidate.apply(newEffects)
      return candidate
    },

    findUniqueConflict(group, value, owner) {
      const existing = unique().get(`${group}${UNIQUE_SEP}${value}`)
      if (existing == null) return undefined
      return existing !== owner ? existing : undefined
    },

    assetReferencesOf(owner) {
      return (byOwner.get(owner) ?? []).filter((e): e is AssetReferenceEffect => e.type === 'asset')
    }
  }
}
