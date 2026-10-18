// Lightweight concurrency-limited task runner.
//
// Schedules async tasks so that at most `limit` run at once. Tasks beyond the
// limit queue and start as slots free up. Pure JS, no deps — runtime-agnostic,
// so it lives under `core/util` and is safe to use from the pipeline/driver.
//
// Used by the driver to read source files concurrently (I/O-bound) without
// spawning unbounded parallel reads.

export interface Pool {
  /** Run a task. Resolves with the task's result (or rejects with its error). */
  run<T>(fn: () => Promise<T>): Promise<T>
  /** Resolve once every queued and in-flight task has settled. */
  drain(): Promise<void>
  /** Number of tasks currently running. */
  readonly active: number
  /** Number of tasks queued, waiting for a slot. */
  readonly pending: number
}

/**
 * Create a concurrency pool that runs at most `limit` tasks simultaneously.
 *
 * `limit` is clamped to a minimum of 1. The pool has no upper bound on queue
 * length; callers are expected to submit a bounded workload (e.g. one task per
 * source file).
 */
export const createPool = (limit: number): Pool => {
  const cap = Math.max(1, Math.floor(limit))
  let active = 0
  const queue: Array<() => Promise<void>> = []
  const drainWaiters: Array<() => void> = []

  const settle = (): void => {
    active--
    if (queue.length > 0) {
      runNext()
    } else if (active === 0) {
      const waiters = drainWaiters.splice(0, drainWaiters.length)
      for (const w of waiters) w()
    }
  }

  const runNext = (): void => {
    const task = queue.shift()
    if (task === undefined) return
    active++
    void task().finally(settle)
  }

  const maybeSchedule = (): void => {
    while (active < cap && queue.length > 0) runNext()
  }

  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const task = async (): Promise<void> => {
          try {
            resolve(await fn())
          } catch (err) {
            reject(err)
          }
        }
        queue.push(task)
        maybeSchedule()
      })
    },
    drain(): Promise<void> {
      if (active === 0 && queue.length === 0) return Promise.resolve()
      return new Promise<void>(resolve => {
        drainWaiters.push(resolve)
      })
    },
    get active() {
      return active
    },
    get pending() {
      return queue.length
    }
  }
}
