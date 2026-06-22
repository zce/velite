/**
 * Minimal path operations the core needs. A pure posix implementation ships
 * with the core (core/util/path.ts); the runtime adapter normalizes platform
 * separators to `/` at the filesystem boundary so the core only ever sees
 * posix paths.
 */
export interface Path {
  join(...segments: string[]): string
  relative(from: string, to: string): string
  normalize(path: string): string
  dirname(path: string): string
  extname(path: string): string
}
