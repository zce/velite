/**
 * Module loader port. Resolves an absolute file path to its evaluated JS module
 * namespace (default + named exports).
 *
 * Adapters can use jiti, native ESM, or a bundler — the contract only says "give
 * me a path, get back the module exports plus any extra source files the loader
 * pulled in" (the latter feeds watch-mode dependency tracking).
 *
 * Velite's own callers (notably `resolveConfig`) treat `default` as the
 * canonical export and fall back to the namespace when no default exists.
 */
export interface ModuleLoader {
  load(absPath: string): Promise<{ exports: unknown; dependencies: string[] }>
}
