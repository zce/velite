import type { FileEvent } from '../runtime/watcher'

/** Merge consecutive events for the same path; the last event wins. */
export const mergeEvents = (events: FileEvent[]): FileEvent[] => {
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

/**
 * Serial rebuild queue with debouncing. While a rebuild runs, new events
 * accumulate; when it finishes, another rebuild starts if the queue is non-empty.
 */
export const createScheduler = (run: (events: FileEvent[]) => Promise<void>, debounceMs = 50): Scheduler => {
  let queue: FileEvent[] = []
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined
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
      if (queue.length > 0 && !disposed) void drain()
    }
  }

  const schedule = (): void => {
    if (disposed) return
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      void drain()
    }, debounceMs)
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
