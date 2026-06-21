/**
 * Schema effects: the collect -> validate -> commit model for cross-file state.
 *
 * Schemas that need cross-file capabilities (uniqueness, asset references,
 * declared dependencies) never mutate shared session state directly during
 * concurrent validation. Instead each record's schema *collects* effects; the
 * pipeline then builds a candidate effect index, validates it against the full
 * live set, and commits it only on a successful build run.
 *
 * Ported verbatim from the pre-refactor `src/schemas/effects.ts`. Self-contained:
 * no imports. Full effect wiring (collect -> validate -> commit) lands in M6;
 * M4 only needs the types and the accumulator contract so `collectEffect` is
 * well-typed inside the schema context.
 */

/** A uniqueness registration effect produced by `s.unique()`. */
export interface UniqueEffect {
  readonly type: 'unique'
  readonly owner: string
  readonly group: string
  readonly value: string
}

/** An asset reference effect produced by `s.file()` / `s.image()`. */
export interface AssetReferenceEffect {
  readonly type: 'asset'
  readonly owner: string
  readonly assetPath: string
  readonly publicUrl: string
  readonly isImage: boolean
}

/** A declared source dependency effect produced by loaders / schemas. */
export interface SourceDependencyEffect {
  readonly type: 'dependency'
  readonly owner: string
  readonly sourceId: string
}

export type Effect = UniqueEffect | AssetReferenceEffect | SourceDependencyEffect

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
        const list = byOwner.get(e.owner)
        if (list == null) byOwner.set(e.owner, [e])
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
