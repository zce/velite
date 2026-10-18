// src/core/util/hash.ts
// Pure-JS, runtime-agnostic, non-cryptographic content hash.
// Used only for cache keys and value-equality (backdating); never for security.
// Two parallel FNV-1a streams give a ~64-bit digest to keep collisions negligible.

const encoder = new TextEncoder()

const PRIME_A = 0x01000193
const PRIME_B = 0x85ebca6b

/** Hash a string or byte sequence into a stable 16-char hex digest. */
export const hash = (input: string | Uint8Array): string => {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input
  let a = 0x811c9dc5
  let b = 0xc2b2ae35
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]!
    a = Math.imul(a ^ byte, PRIME_A)
    b = Math.imul(b ^ byte, PRIME_B)
  }
  return hex(a) + hex(b)
}

const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, '0')
