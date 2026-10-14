import type { FileEvent } from '../runtime/watcher'

/** Deduplicate queued events by path; the last event per path wins. */
const mergeEvents = (events: FileEvent[]): FileEvent[] => {
  const byPath = new Map<string, FileEvent>()
  for (const event of events) byPath.set(event.absPath, event)
  return [...byPath.values()]
}

export interface Scheduler {
  /** Queue events; a debounced, serial rebuild runs automatically. */
  push(events: FileEvent[]): void
  /** Stop accepting events and cancel pending debounced runs. */
  dispose(): void
}

export interface SchedulerDeps {
  /**
   * Run one rebuild batch. Serial: the scheduler never overlaps runs. Must
   * handle its own errors — a rejection here escapes as an unhandled
   * rejection because the scheduler fires and forgets its drains.
   */
  run(events: FileEvent[]): Promise<void>
  debounceMs?: number
}

/**
 * Serial rebuild queue with debouncing. While a rebuild runs, new events
 * accumulate; when it finishes, another rebuild starts if the queue is non-empty.
 */
export const createScheduler = ({ run, debounceMs = 50 }: SchedulerDeps): Scheduler => {
  let queue: FileEvent[] = []
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let microtask = false
  let disposed = false

  const drain = async (): Promise<void> => {
    if (disposed || running) return
    running = true
    try {
      while (queue.length > 0 && !disposed) {
        const batch = mergeEvents(queue)
        queue = []
        await run(batch)
      }
    } finally {
      running = false
      if (queue.length > 0 && !disposed) schedule()
    }
  }

  const schedule = (): void => {
    if (disposed) return
    if (debounceMs > 0) {
      // One pending timer at a time; a later push replaces the timer.
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        void drain()
      }, debounceMs)
    } else {
      // Zero debounce: use microtask to avoid setTimeout's ~1ms minimum delay.
      if (microtask) return
      microtask = true
      void Promise.resolve().then(() => {
        microtask = false
        void drain()
      })
    }
  }

  return {
    push(events) {
      if (disposed) return
      queue.push(...events)
      schedule()
    },
    dispose() {
      disposed = true
      if (timer !== undefined) clearTimeout(timer)
      queue = []
    }
  }
}
