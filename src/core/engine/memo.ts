// src/core/engine/memo.ts
import type { InputId } from './engine'

/**
 * A single tracked dependency recorded while a derivation runs.
 * Either a raw external input or another derivation's memo.
 */
export type Dependency = { readonly kind: 'input'; readonly id: InputId; readonly missing: boolean } | { readonly kind: 'derivation'; readonly memoKey: string }
