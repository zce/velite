/** A value or a promise of the value. */
export type Promisable<T> = T | Promise<T>

/** A source file ready to be loaded. */
export interface LoaderSource {
  readonly id: string
  readonly path: string
  readonly content: string | Uint8Array
}

/** Context passed to a loader's `load` function. */
export interface LoaderContext {
  readonly source: LoaderSource
}

/** A single raw record produced by a loader. */
export interface LoaderRecord {
  /** Stable record key forming part of the record identity. */
  key?: string
  /** Raw record data, to be validated by the collection schema. */
  data: unknown
  /** Loader-specific metadata, not part of the stable user data model. */
  metadata?: Record<string, unknown>
}

/** Result of loading a source. */
export interface LoaderResult {
  records: LoaderRecord[]
  /** Additional source dependencies the loader read (enter the dependency graph). */
  dependencies?: string[]
  /** Source-level metadata. */
  metadata?: Record<string, unknown>
}

/**
 * A loader turns a `LoaderSource` into one or more raw `LoaderRecord`s.
 *
 * Loaders do not perform schema validation and do not write output. They may
 * declare additional source dependencies, which enter the dependency graph.
 */
export interface Loader {
  test: RegExp | ((source: LoaderSource) => boolean)
  load(source: LoaderSource, context: LoaderContext): Promisable<LoaderResult>
}

/** Match a loader against a source path. */
export const matchesLoader = (loader: Loader, source: LoaderSource): boolean => {
  if (typeof loader.test === 'function') return loader.test(source)
  return loader.test.test(source.path)
}

/** Define a loader (identity helper for type inference). */
export const defineLoader = <T extends Loader>(loader: T): T => loader
