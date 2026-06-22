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
