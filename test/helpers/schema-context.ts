// Source-level record harness using the same leased host/content owner as production.
import { createDefaultContentExecutionsFactory } from '../../src/core/content/execution/record'
import { createContentFile, createSessionStore } from '../../src/core/schema/context'
import { schemaContextHost } from '../../src/core/schema/host'
import { testSchemaRunner } from './runtime'

import type { AssetResult, BlurOptions } from '../../src/core/assets'
import type { ContentRequest } from '../../src/core/schema/capability'
import type { AssetRequest, ContentFile, ContentRecord, ImageMetadata, ProjectInfo, SchemaContext, SessionStore } from '../../src/core/schema/context'
import type { EffectDeclarationContext, SchemaEffectDeclaration } from '../../src/core/schema/effects'
import type { SchemaRunInput, SchemaRunner } from '../../src/core/schema/runner'

let testRunner: SchemaRunner | undefined

export const ensureTestSchemaRunner = (): SchemaRunner => {
  return (testRunner ??= testSchemaRunner())
}

export interface RunWithContextInput {
  readonly project: ProjectInfo
  readonly file: ContentFile
  readonly record: ContentRecord
  readonly store?: SessionStore
  readonly collectEffect: (declaration: SchemaEffectDeclaration, context: EffectDeclarationContext) => void
  readonly asset: (assetKey: string, request?: AssetRequest) => Promise<AssetResult>
  readonly readFile: (absPath: string) => Promise<Uint8Array>
  readonly probeImage: (bytes: Uint8Array, blur?: BlurOptions) => Promise<ImageMetadata>
  readonly contentOperation?: (request: ContentRequest) => Promise<unknown>
  readonly onContentDemand?: (request: ContentRequest) => void
}

export const runWithContext = async <R>(input: RunWithContextInput, run: () => R | PromiseLike<R>): Promise<R> => {
  const runner = ensureTestSchemaRunner()
  const content = createDefaultContentExecutionsFactory(schemaContextHost()).open({
    project: input.project,
    file: input.file,
    record: input.record,
    collection: { order: 0, id: 'test' },
    collectEffects(declarations) {
      for (const [declaration, context] of declarations) input.collectEffect(declaration, context)
    }
  })
  const runInput: SchemaRunInput = {
    project: input.project,
    file: input.file,
    record: input.record,
    store: input.store ?? createSessionStore(),
    collectEffect: content.collectEffect,
    asset: input.asset,
    readFile: input.readFile,
    probeImage: input.probeImage,
    contentOperation(request) {
      input.onContentDemand?.(request)
      return (input.contentOperation ?? content.demand)(request)
    }
  }
  try {
    return await runner.run(runInput, run)
  } finally {
    content.close()
  }
}

export { createContentFile }
