// src/core/util/glob.ts
import picomatch from 'picomatch'

export type Matcher = (path: string) => boolean

/**
 * Compile include/exclude globs into a matcher over posix paths.
 * picomatch is pure JS (runtime-agnostic); it never touches the filesystem.
 */
export const createMatcher = (include: string[], exclude: string[] = []): Matcher => {
  const isMatch = picomatch(include, exclude.length > 0 ? { ignore: exclude } : {})
  return (path: string) => isMatch(path)
}
