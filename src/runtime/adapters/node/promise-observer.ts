import { AsyncLocalStorage } from 'node:async_hooks'
import { promiseHooks } from 'node:v8'

import { fail } from '../../../core/diagnostic'

import type { PromiseObserver } from '../../promise-observer'

export interface NodePromiseObserver extends PromiseObserver {
  /** Custom composition owners stop observing only after their async work ends. */
  dispose(): void
}

export interface NodePromiseObserverDeps {
  /** Run bookkeeping without inheriting the schema host's record carrier. */
  runUnbound<T>(operation: () => T): T
}

const observeSettlement = async (promise: Promise<unknown>): Promise<void> => {
  try {
    // Native await attaches a reaction without consulting Promise species.
    // Discard the value/reason only on this separate observation branch.
    await promise
  } catch {}
}

/**
 * Observe native Promise creation only in a schema's async scope. The immutable
 * ALS marker carries no record, lease, capability, artifact, or Promise list.
 * Keep the hook installed across record settlement: old async contexts may
 * create new Zod chains after the lease has already closed.
 */
export const createNodePromiseObserver = ({ runUnbound }: NodePromiseObserverDeps): NodePromiseObserver => {
  const scope = new AsyncLocalStorage<true | undefined>()
  let disposed = false
  const stop = promiseHooks.onInit(promise => {
    if (scope.getStore() !== true) return
    // The hook stays synchronous. Clear this marker while creating the observer's
    // own async/await continuations, including later thenable assimilation, so
    // bookkeeping cannot recursively observe itself. Actual waiters are untouched.
    // run(undefined) restores the outer marker without disabling/re-enabling
    // ALS for every Promise (unlike exit() on the minimum supported Node 22).
    void scope.run(undefined, () => runUnbound(() => observeSettlement(promise)))
  })
  return {
    run(operation) {
      if (disposed) fail('internal', 'Promise observer is disposed')
      return scope.run(true, operation)
    },
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      scope.disable()
    }
  }
}
