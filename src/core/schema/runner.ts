// SchemaRunner — the narrow capability explicitly injected into the internal
// Builder, pipeline, and validate composition. Accepts synchronous or
// asynchronous operations but always returns `Promise<T>` so lease closure
// occurs after settlement. Constructs the private carrier, creates the lease,
// wraps record-bound capabilities with that lease, delegates propagation to
// the host, awaits the operation, and deactivates the lease in `finally`.
//
// Authority: Ticket 21. Internal — not exported from any public barrel.

import { fail } from '../diagnostic'
import { installSchemaContextHost, schemaContextHost } from './host'

import type { ContentRequest, RecordContentCapability } from './capability'
import type { SchemaContext } from './context'
import type { SchemaContextHost } from './host'
import type { SchemaRunContext } from './run'

/**
 * Input to a schema run. Contains the distinct public {@link SchemaContext}
 * view fields and the raw narrow record-bound `content(request)` operation
 * required to construct the leased private capability.
 */
export interface SchemaRunInput {
  readonly project: SchemaContext['project']
  readonly file: SchemaContext['file']
  readonly record: SchemaContext['record']
  readonly store: SchemaContext['store']
  readonly collectEffect: SchemaContext['collectEffect']
  readonly asset: SchemaContext['asset']
  readonly readFile: SchemaContext['readFile']
  readonly probeImage: SchemaContext['probeImage']
  /** Raw record-bound content operation; lease-checked per invocation. */
  readonly contentOperation: (request: ContentRequest) => Promise<unknown>
}

/**
 * Build the eight-field public {@link SchemaContext} from a schema run input.
 * The returned object carries no carrier, lease, private capability, or
 * private symbol. Internal — used by the {@link SchemaRunner}.
 */
export const createPublicSchemaContext = (input: SchemaRunInput): SchemaContext => ({
  project: input.project,
  file: input.file,
  record: input.record,
  store: input.store,
  collectEffect: input.collectEffect,
  asset: input.asset,
  readFile: input.readFile,
  probeImage: input.probeImage
})

/**
 * The narrow capability explicitly injected into internal Builders. Accepts
 * synchronous or asynchronous operations but always returns `Promise<T>` so
 * lease closure occurs after settlement. Internal — not exported.
 */
export interface SchemaRunner {
  run<T>(input: SchemaRunInput, operation: () => T | PromiseLike<T>): Promise<T>
}

/**
 * Create a {@link SchemaRunner} bound to the installed process-owned host.
 * Internal composition root use only. The host must already be installed.
 */
export const createSchemaRunner = (host: SchemaContextHost = schemaContextHost()): SchemaRunner => {
  const runner: SchemaRunner = {
    async run<T>(input: SchemaRunInput, operation: () => T | PromiseLike<T>): Promise<T> {
      const lease = { active: true }
      const leasedCapability: RecordContentCapability = {
        content: request => {
          if (!lease.active) {
            fail('internal', 'Schema run lease is inactive — captured content capability used after settlement')
          }
          return input.contentOperation(request)
        }
      }
      const publicContext = createPublicSchemaContext(input)
      const carrier: SchemaRunContext = { publicContext, content: leasedCapability, lease }
      return host.run(carrier, async () => {
        try {
          return await operation()
        } finally {
          lease.active = false
        }
      })
    }
  }
  return runner
}

/** Install the default Node host if no host is installed yet. Internal. */
export const ensureHostInstalled = (hostFactory: () => SchemaContextHost): SchemaContextHost => {
  const existing = tryGetHost()
  if (existing !== undefined) return existing
  const host = hostFactory()
  installSchemaContextHost(host)
  return host
}

const tryGetHost = (): SchemaContextHost | undefined => {
  try {
    return schemaContextHost()
  } catch {
    return undefined
  }
}
