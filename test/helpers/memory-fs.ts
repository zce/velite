import type { FileSystem } from '../../src/core/host/fs'

const encoder = new TextEncoder()

/**
 * In-memory FileSystem for tests. Runtime-agnostic (plain Map), so it doubles as
 * a reference adapter the core can run against without touching disk.
 *
 * NOTE: `walk` currently returns every stored path under `root` and ignores the
 * include/exclude globs — glob matching is the pipeline's responsibility (added
 * with util/glob in a later milestone). Enough for engine/host-contract tests.
 */
export class MemoryFileSystem implements FileSystem {
  private readonly files = new Map<string, Uint8Array>()
  private readonly mtimes = new Map<string, number>()
  private clock = 0

  /** Seed/overwrite a file. Accepts string or bytes. */
  put(absPath: string, data: string | Uint8Array): void {
    this.files.set(absPath, typeof data === 'string' ? encoder.encode(data) : data)
    this.mtimes.set(absPath, ++this.clock)
  }

  async read(absPath: string): Promise<Uint8Array> {
    const data = this.files.get(absPath)
    if (data === undefined) throw new Error(`ENOENT: ${absPath}`)
    return data
  }

  async stat(absPath: string): Promise<{ mtimeMs: number; size: number }> {
    const data = this.files.get(absPath)
    if (data === undefined) throw new Error(`ENOENT: ${absPath}`)
    return { mtimeMs: this.mtimes.get(absPath) ?? 0, size: data.byteLength }
  }

  async walk(root: string, _options?: { include: string[]; exclude: string[] }): Promise<string[]> {
    const prefix = root.endsWith('/') ? root : root + '/'
    return [...this.files.keys()].filter(p => p === root || p.startsWith(prefix)).sort()
  }

  async write(absPath: string, data: Uint8Array): Promise<void> {
    this.put(absPath, data)
  }

  async remove(absPath: string): Promise<void> {
    this.files.delete(absPath)
    this.mtimes.delete(absPath)
  }
}
