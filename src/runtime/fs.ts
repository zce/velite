/**
 * The only I/O surface the core touches. Adapters (Node, Deno, in-memory, ...)
 * implement this; the core never imports a runtime filesystem directly.
 * All paths are absolute and posix-normalized at this boundary.
 */
export interface FileSystem {
  read(absPath: string): Promise<Uint8Array>
  stat(absPath: string): Promise<{ mtimeMs: number; size: number }>
  walk(root: string, options: { include: string[]; exclude: string[] }): Promise<string[]>
  write(absPath: string, data: Uint8Array): Promise<void>
  /**
   * Remove a file or (with `recursive: true`) a directory tree. Missing paths
   * must be silently ignored — `clean()` calls this against output dirs that
   * may not exist yet.
   */
  remove(absPath: string, options?: { recursive?: boolean }): Promise<void>
}
