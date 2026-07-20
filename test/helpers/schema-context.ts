// Test-facing schema context shims. These wrap the process-owned
// SchemaContextHost + SchemaRunner so source-internal unit tests using the
// pre-1.0 `installContextStorage` + `runWithContext` shape keep working during
// the Phase 1-3 migration. They live in test/ (not core) so core stays
// runtime-neutral. Removed once all tests migrate to `schemaRunner.run`.

import { createContentFile, createSessionStore } from '../../src/core/schema/context'
import { createDefaultContentArtifactsFactory } from '../../src/core/schema/derivation/broker'
import { installSchemaContextHost, schemaContextHost } from '../../src/core/schema/host'
import { createSchemaRunner } from '../../src/core/schema/runner'
import { createNodeSchemaContextHost } from '../../src/runtime/adapters/node/schema-host'

import type { AssetResult, BlurOptions } from '../../src/core/pipeline/asset'
import type { ContentRequest } from '../../src/core/schema/capability'
import type { AssetRequest, ContentFile, ContentRecord, ImageMetadata, ProjectInfo, SchemaContext, SessionStore } from '../../src/core/schema/context'
import type { RecordScope } from '../../src/core/schema/derivation/broker'
import type { Effect, EffectDeclarationContext, SchemaEffectDeclaration } from '../../src/core/schema/effects'
import type { SchemaRunInput, SchemaRunner } from '../../src/core/schema/runner'

let testRunner: SchemaRunner | undefined

/**
 * Install the shared test Node host once per process; idempotent. Installing
 * the identical host is a no-op; tests never replace the host in beforeEach.
 */
export const ensureTestSchemaRunner = (): SchemaRunner => {
  if (testRunner !== undefined) return testRunner
  try {
    schemaContextHost()
  } catch {
    installSchemaContextHost(createNodeSchemaContextHost())
  }
  testRunner = createSchemaRunner()
  return testRunner
}

/** @internal Input shape matching the pre-1.0 RunWithContextInput. */
export interface RunWithContextInput {
  readonly project: ProjectInfo
  readonly file: ContentFile
  readonly record: ContentRecord
  readonly store?: SessionStore
  readonly collectEffect: (effect: Effect | SchemaEffectDeclaration, context?: EffectDeclarationContext) => void
  readonly asset: (assetKey: string, request?: AssetRequest) => Promise<AssetResult>
  readonly readFile: (absPath: string) => Promise<Uint8Array>
  readonly probeImage: (bytes: Uint8Array, blur?: BlurOptions) => Promise<ImageMetadata>
  /**
   * Optional override for the private record-bound content operation. When
   * omitted, a real record-scoped broker is constructed from the default
   * content artifacts factory and disposed after the run settles. This keeps
   * the T2.1/T2.2 behavior tests passing without the transitional
   * `?? parseMarkdown(body)` fallback that T2.3 removed.
   */
  readonly contentOperation?: (request: ContentRequest) => Promise<unknown>
  /**
   * Optional observer invoked before the real broker handles each content
   * demand. Use this to count demands without intercepting the result. Only
   * used when `contentOperation` is NOT provided.
   */
  readonly onContentDemand?: (request: ContentRequest) => void
}

/**
 * Run `run` inside a schema context for a single record parse. Uses the
 * process-owned SchemaContextHost + SchemaRunner. Test-facing shim.
 *
 * When no `contentOperation` override is provided, a real record-scoped
 * broker is opened and disposed in an outer `finally` (matching the
 * production validate wiring). Pass `onContentDemand` to observe demands
 * without intercepting them.
 */
export const runWithContext = async <R>(input: RunWithContextInput, run: () => R | PromiseLike<R>): Promise<R> => {
  const runner = ensureTestSchemaRunner()
  if (input.contentOperation !== undefined) {
    const runInput: SchemaRunInput = {
      project: input.project,
      file: input.file,
      record: input.record,
      store: input.store ?? createSessionStore(),
      collectEffect: input.collectEffect as SchemaContext['collectEffect'],
      asset: input.asset,
      readFile: input.readFile,
      probeImage: input.probeImage,
      contentOperation: input.contentOperation
    }
    return runner.run(runInput, run)
  }
  const factory = createDefaultContentArtifactsFactory()
  const scope: RecordScope = { recordId: input.record.id, sourcePath: input.file.path, cwd: input.project.root }
  const broker = factory.open(scope)
  const observer = input.onContentDemand
  const contentOperation =
    observer === undefined
      ? (request: ContentRequest) => broker.demand(request)
      : (request: ContentRequest) => {
          observer(request)
          return broker.demand(request)
        }
  const runInput: SchemaRunInput = {
    project: input.project,
    file: input.file,
    record: input.record,
    store: input.store ?? createSessionStore(),
    collectEffect: input.collectEffect as SchemaContext['collectEffect'],
    asset: input.asset,
    readFile: input.readFile,
    probeImage: input.probeImage,
    contentOperation
  }
  try {
    return await runner.run(runInput, run)
  } finally {
    broker.dispose()
  }
}

/** Re-export so existing tests that import installContextStorage from context still work. */
export { createContentFile }
