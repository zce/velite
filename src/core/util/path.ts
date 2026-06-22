// src/core/util/path.ts
import type { Path } from '../../runtime/path'

// Pure posix path operations. The core only ever deals in posix ('/') paths;
// runtime adapters normalize platform separators at the filesystem boundary.

const normalize = (path: string): string => {
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

const join = (...segments: string[]): string => normalize(segments.join('/'))

const relative = (from: string, to: string): string => {
  const fromParts = normalize(from).split('/').filter(Boolean)
  const toParts = normalize(to).split('/').filter(Boolean)
  let i = 0
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) i++
  const up = fromParts.slice(i).map(() => '..')
  return [...up, ...toParts.slice(i)].join('/') || '.'
}

const dirname = (path: string): string => {
  const i = path.lastIndexOf('/')
  if (i < 0) return '.'
  if (i === 0) return '/'
  return path.slice(0, i)
}

const extname = (path: string): string => {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const i = base.lastIndexOf('.')
  return i > 0 ? base.slice(i) : ''
}

/** A pure posix implementation of the {@link Path} runtime contract. */
export const posix: Path = { join, relative, normalize, dirname, extname }
