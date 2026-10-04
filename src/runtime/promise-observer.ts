/**
 * Internal runtime capability for observing otherwise abandoned rejections in
 * one schema operation and its asynchronous descendants. Observation must not
 * change the callback's return value, thrown error, or any Promise outcome.
 * It is not cancellation, drainage, diagnostic reporting, or a public service.
 */
export interface PromiseObserver {
  run<T>(operation: () => T): T
}
