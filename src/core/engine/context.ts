// src/core/engine/context.ts
import type { Derivation, InputId } from './engine'

/**
 * Injected into a derivation while it runs. Every read through this context is
 * automatically recorded as a dependency, so the engine can later decide what
 * to recompute. Derivations must read inputs and other derivations ONLY through
 * this context (never from closures or globals), otherwise tracking is unsound.
 */
export interface Context {
  /** Read another derivation's value, recording a dependency on it. */
  get<K, V>(derivation: Derivation<K, V>, key: K): Promise<V>
  /** Read an external input value, recording a dependency on it. */
  input<V>(id: InputId): V
}
