/**
 * Module loader port. Resolves an absolute file path to its evaluated export
 * value.
 *
 * Adapters can use jiti, native ESM, or a bundler — the contract only says "give
 * me a path, get back the module exports plus any extra source files the loader
 * pulled in" (the latter feeds watch-mode dependency tracking).
 *
 * Velite's Node adapter uses jiti's `default: true` import mode, so default
 * exports are already unwrapped before `resolveConfig` validates the value.
 */
export interface ModuleLoader {
  load(absPath: string): Promise<{ exports: unknown; dependencies: string[] }>
}
