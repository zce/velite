/** Loads a user config module (TS/JS) and its dependency file list. */
export interface ConfigLoader {
  load(absPath: string): Promise<{ config: unknown; dependencies: string[] }>
}
