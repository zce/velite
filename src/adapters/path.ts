import nodePosix from 'node:path/posix'

import type { Path } from '../runtime/path'

/**
 * Node adapter for the {@link Path} runtime contract. Wraps `node:path/posix`
 * so the core's "everything is posix" invariant holds at the runtime boundary
 * — adapters dealing with OS paths are responsible for normalizing to `/`.
 *
 * The core also ships a pure-JS posix implementation (`core/util/path.ts`)
 * for its own internal needs (and for in-memory test runtimes that cannot
 * import `node:*`). This adapter does not depend on it: the core must not be
 * a substrate for runtime adapters.
 */
export const nodePath: Path = {
  join: nodePosix.join,
  relative: nodePosix.relative,
  normalize: nodePosix.normalize,
  dirname: nodePosix.dirname,
  extname: nodePosix.extname
}
