// Schema effects — the collect → validate → commit model for cross-file state.
//
// Authority: Ticket 23 (Complete effect and diagnostic transaction seams) —
// final concept-convergence resolution. Effects are owner- and provenance-
// bearing declarative facts promoted through stage, valid-record, cross-file-
// valid, and committed-generation transactions. Custom declarations provide a
// record-rooted semantic path, stable declaration ordinal, and one validated
// stable occurrence; Velite supplies system owner/source provenance. Call
// order, append order, visitation counters, cache hits, Promise completion,
// and object identity are forbidden identity and ordering sources.
//
// Custom occurrence is exactly `singleton`, `source-index`, or `key`. Velite-
// controlled schemas may retain a private authoritative half-
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
