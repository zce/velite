// Pure posix path operations the core uses everywhere internally.
//
// Why a hand-rolled implementation rather than a `runtime.path` port? Path
// semantics are *definitional* in this codebase — the core only ever deals in
// posix ('/') paths; runtime adapters normalize platform separators at the
// filesystem boundary. There is no "alternate implementation" that would make
// sense to plug in (Deno, Bun, Node all want the same posix behaviour here),
// so making it a runtime capability would only add a parameter to every
// schema/pipeline function for no replaceability benefit.
//
// Implementing it inline (rather than re-exporting `node:path/posix`) keeps
// `src/core/` free of `node:*` imports — guarded by test/runtime-neutral —
// which is what lets the core run unchanged under non-Node runtimes.

const doNormalize = (path: string): string => {
  const isAbsolute = path.startsWith('/')
  const out: string[] = []
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop()
      else if (!isAbsolute) out.push('..')
    } else {
      out.push(segment)
    }
  }
  return (isAbsolute ? '/' : '') + out.join('/') || (isAbsolute ? '/' : '.')
}

/** Normalize a posix path: collapse `.` / `..` / duplicate slashes. */
export const normalize = (path: string): string => doNormalize(path)

/** Join segments with `/` and normalize the result. */
export const join = (...segments: string[]): string => doNormalize(segments.join('/'))

/** Return the relative path from `from` to `to`. Both are normalized first. */
export const relative = (from: string, to: string): string => {
  const fromParts = doNormalize(from).split('/').filter(Boolean)
  const toParts = doNormalize(to).split('/').filter(Boolean)
  let i = 0
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++
  const up = fromParts.slice(i).map(() => '..')
  return [...up, ...toParts.slice(i)].join('/') || '.'
}

/** Return the directory portion of `path` (everything before the last `/`). */
export const dirname = (path: string): string => {
  const i = path.lastIndexOf('/')
  if (i < 0) return '.'
  if (i === 0) return '/'
  return path.slice(0, i)
}

/** Return the extension of `path`, including the leading dot, or `''`. */
export const extname = (path: string): string => {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const i = base.lastIndexOf('.')
  return i > 0 ? base.slice(i) : ''
}

/**
 * Strip a trailing `?query` and/or `#hash` from an asset reference string.
 * Cache-busting suffixes are common on asset urls and must not reach the
 * filesystem. The cleaned reference is used for the actual file path lookup.
 */
export const stripQueryAndHash = (value: string): string => {
  const queryIdx = value.indexOf('?')
  const hashIdx = value.indexOf('#')
  const index = Math.min(queryIdx >= 0 ? queryIdx : Infinity, hashIdx >= 0 ? hashIdx : Infinity)
  return index === Infinity ? value : value.slice(0, index)
}
