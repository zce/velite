/**
 * Ambient-value scoping port.
 *
 * Used by the schema layer to propagate the per-record SchemaContext through
 * zod's async transforms — whose callback signature does not allow explicit
 * context injection. Implementations must:
 *
 *   1. honor LIFO nesting (run-inside-run sees the inner value),
 *   2. survive `await` boundaries within the callback,
 *   3. return `undefined` from `get()` when no scope is active.
 *
 * Conceptually identical to Node's `AsyncLocalStorage`; this port keeps the
 * core decoupled from `node:async_hooks` so non-Node runtimes can supply their
 * own (Deno/Bun ship the same API; an in-memory adapter is fine for tests).
 */
export interface ContextStorage<T> {
  run<R>(value: T, fn: () => R): R
  get(): T | undefined
}

export type ContextStorageHost<TContext> = {
  /** Install a storage implementation. Called once at the composition root. */
  install(storage: ContextStorage<TContext>): void

  /** Run `fn` with `value` as the ambient context for the duration of `fn`. */
  run<TResult>(value: TContext, fn: () => TResult): TResult

  /** Get the current context. Throws when called outside a bound execution. */
  get(): TContext

  /** Get the current context, or `undefined` when called outside a bound execution. */
  tryGet(): TContext | undefined
}

/**
 * Create a runtime context — a controlled ambient value accessor.
 *
 * The returned API has a strict two-phase lifecycle:
 * 1. `install(storage)` — called once at the composition root.
 * 2. `run(value, fn)` / `get()` / `tryGet()` — used at runtime.
 *
 * @param name  Human-readable name for error messages.
 */
export function createContext<TContext>(name = 'Context'): ContextStorageHost<TContext> {
  let storage: ContextStorage<TContext> | undefined

  const missingStorage = `${name} storage is not installed`
  const missingContext = `${name} context is not available`

  return {
    install(value) {
      storage = value
    },

    run(value, fn) {
      if (!storage) throw new Error(missingStorage)
      return storage.run(value, fn)
    },

    get() {
      if (!storage) throw new Error(missingStorage)
      const value = storage.get()
      if (!value) throw new Error(missingContext)
      return value
    },

    tryGet() {
      return storage?.get()
    }
  }
}
