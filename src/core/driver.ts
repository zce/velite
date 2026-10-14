import { assetInput, assetKeyOf } from './assets'
import { createEventClassifier } from './classify'
import { diagnostic, equalDiagnosticValue, firstFatalDiagnostic, normalizeDiagnosticValue, VeliteError } from './diagnostic'
import { loadManifest, MANIFEST_FILENAME, saveManifest } from './output/manifest'
import { writeOutput } from './output/writer'
import { buildProjectInfo, fileInput, TREE } from './pipeline'
import { compareStrings } from './util/compare'
import { join, relative } from './util/path'
import { createPool } from './util/pool'

import type { FileSystem } from '../runtime/fs'
import type { Logger } from '../runtime/logger'
import type { FileEvent } from '../runtime/watcher'
import type { AssetKey } from './assets'
import type { PrepareCollections, PrepareContext, PrepareDiagnosticInput, ResolvedConfig } from './config'
import type { Diagnostic, DiagnosticValue, VeliteErrorCode } from './diagnostic'
import type { Engine } from './engine'
import type { LogicalOutput } from './output/logical'
import type { DataManifest, OutputManifest } from './output/manifest'
import type { EntryJsonCache } from './output/writer'
import type { Pipeline, TreeFile } from './pipeline'
import type { Emitted } from './pipeline/types'
import type { AssetReferenceEffect } from './schema/effects'

/**
 * Runtime capabilities the driver actually touches at build time. Stated
 * explicitly so this layer doesn't pull in `modules`/`image`/`watch` (those
 * belong to config loading, asset derivation, and the watch loop respectively).
 */
export interface DriverRuntime {
  fs: FileSystem
  logger: Logger
}

export interface RunContext {
  engine: Engine
  pipeline: Pipeline
  config: ResolvedConfig
  runtime: DriverRuntime
  /** Shadow copy of the tree input, kept in sync with the engine. */
  tree: TreeFile[]
  manifest: DataManifest
  /** Asset dest paths written in the previous successful run (reconcile set). */
  assetManifest: Set<string>
  lastEmitted?: Emitted
  sourceCollections: Map<string, Set<string>>
  changedPaths?: Set<string>
  patchedCollections?: Set<string>
  /** Entry JSON string cache for single layout incremental builds. */
  entryJsonCache: EntryJsonCache
}

export interface BuildResult {
  output: LogicalOutput
  diagnostics: Diagnostic[]
  /** Output files written this run. */
  written: string[]
}

export type ApplyResult = 'config-reload' | 'content' | 'none'

export interface Driver {
  runBuild(layout?: 'split' | 'single'): Promise<BuildResult>
  runIncremental(layout?: 'split' | 'single'): Promise<BuildResult>
  applyChanges(events: FileEvent[]): Promise<ApplyResult>
}

export interface DriverDeps {
  context: RunContext
}

export interface RunContextDeps {
  engine: Engine
  pipeline: Pipeline
  config: ResolvedConfig
  runtime: DriverRuntime
}

const sortTree = (tree: TreeFile[]): TreeFile[] => tree.sort((a, b) => compareStrings(a.path, b.path))

// --- Prepare diagnostic sink ------------------------------------------------
//
// Sole append-only prepare diagnostic channel. `addDiagnostic` synchronously
// normalizes and snapshots `cause`, appends a `prepare`-stage diagnostic with
// `origin = { kind: 'prepare-hook', key }` and project provenance, then closes
// at hook settlement. Late calls throw `VeliteError('internal')` and append
// nothing. Exact same-key declarations collapse. Reusing a key with a
// different normalized payload yields one Velite-authored fatal prepare
// conflict diagnostic and selects no winner. Reversing call or completion
// order yields the same set and order.
//
// A hook declaration is accepted only when ordinary reflection reports an
// Object-prototype or null-prototype record containing exactly own data
// properties `key`, `level`, `code`, `message`, and optional `cause`. Unknown
// string keys, symbol keys, accessors, inherited fields, invalid levels, or
// empty key/code are malformed; reflection failure is malformed. No Proxy
// detector is used.

/** Internal sink entry. `conflict === true` marks a same-key payload clash. */
interface SinkEntry {
  readonly input: PrepareDiagnosticInput
  readonly normalizedCause: DiagnosticValue | undefined
  readonly conflict?: true
}

interface PrepareSink {
  /** Snapshot of the diagnostics appended so far. */
  readonly diagnostics: readonly Diagnostic[]
  /** The sink's `addDiagnostic` closure, bound to this sink. */
  readonly addDiagnostic: PrepareContext['addDiagnostic']
  /** Close the sink at hook settlement. Idempotent. */
  readonly close: () => void
}

/** Build a Velite-authored prepare-conflict diagnostic for a same-key clash. */
const prepareConflictDiagnostic = (key: string): Diagnostic =>
  diagnostic('error', 'PREPARE_CONFLICT', `prepare hook declared diagnostic key '${key}' with conflicting payloads`, {
    stage: 'prepare',
    origin: { kind: 'velite' },
    provenance: { scope: 'project' },
    context: { key }
  })

const VALID_LEVELS: ReadonlySet<string> = new Set(['error', 'warn', 'info'])
const ALLOWED_FIELDS: ReadonlySet<string> = new Set(['key', 'level', 'code', 'message', 'cause'])

/**
 * Validate a `PrepareDiagnosticInput` against the sole-prepare-sink shape
 * contract. Accepted when ordinary reflection reports an Object-prototype or
 * null-prototype record containing exactly own data properties `key`, `level`,
 * `code`, `message`, and optional `cause`. Unknown string keys, symbol keys,
 * accessors, inherited fields, invalid levels, or empty key/code are
 * malformed. Reflection failure is malformed. No Proxy detector is used.
 */
const validatePrepareInput = (input: PrepareDiagnosticInput): void => {
  if (typeof input !== 'object' || input === null) throw new VeliteError('internal', { message: 'PrepareDiagnosticInput must be an object' })
  let proto: object | null
  try {
    proto = Object.getPrototypeOf(input)
  } catch {
    throw new VeliteError('internal', { message: 'PrepareDiagnosticInput reflection failed' })
  }
  if (proto !== null && proto !== Object.prototype) {
    throw new VeliteError('internal', { message: 'PrepareDiagnosticInput must be an ordinary Object-prototype or null-prototype record' })
  }
  let ownKeys: (string | symbol)[]
  try {
    ownKeys = Reflect.ownKeys(input)
  } catch {
    throw new VeliteError('internal', { message: 'PrepareDiagnosticInput reflection failed' })
  }
  for (const k of ownKeys) {
    if (typeof k === 'symbol') throw new VeliteError('internal', { message: 'PrepareDiagnosticInput must not carry symbol keys' })
    if (!ALLOWED_FIELDS.has(k)) throw new VeliteError('internal', { message: `PrepareDiagnosticInput has unknown field '${k}'` })
    const desc = Object.getOwnPropertyDescriptor(input, k)
    if (desc === undefined || 'get' in desc || 'set' in desc) {
      throw new VeliteError('internal', { message: `PrepareDiagnosticInput field '${k}' must be a data property, not an accessor` })
    }
  }
  const key = (input as { key?: unknown }).key
  if (typeof key !== 'string' || key.length === 0) throw new VeliteError('internal', { message: 'PrepareDiagnosticInput.key must be a non-empty string' })
  const level = (input as { level?: unknown }).level
  if (typeof level !== 'string' || !VALID_LEVELS.has(level)) {
    throw new VeliteError('internal', { message: `PrepareDiagnosticInput.level must be 'error' | 'warn' | 'info' (got '${String(level)}')` })
  }
  const code = (input as { code?: unknown }).code
  if (typeof code !== 'string' || code.length === 0) throw new VeliteError('internal', { message: 'PrepareDiagnosticInput.code must be a non-empty string' })
  const message = (input as { message?: unknown }).message
  if (typeof message !== 'string') throw new VeliteError('internal', { message: 'PrepareDiagnosticInput.message must be a string' })
}

/**
 * Create a fresh append-only prepare diagnostic sink. The sink is single-use:
 * `close()` is called once at hook settlement, after which `addDiagnostic`
 * throws `VeliteError('internal')` and appends nothing.
 */
const createPrepareSink = (): PrepareSink => {
  const entries = new Map<string, SinkEntry>()
  let closed = false
  const sameCause = (a: DiagnosticValue | undefined, b: DiagnosticValue | undefined): boolean => {
    if (a === undefined && b === undefined) return true
    if (a === undefined || b === undefined) return false
    return equalDiagnosticValue(a, b)
  }
  const addDiagnostic = (raw: PrepareDiagnosticInput): void => {
    if (closed) throw new VeliteError('internal', { message: 'Prepare sink is closed — addDiagnostic called after hook settlement' })
    validatePrepareInput(raw)
    const normalizedCause = raw.cause !== undefined ? normalizeDiagnosticValue(raw.cause) : undefined
    const existing = entries.get(raw.key)
    if (existing !== undefined) {
      // Exact-duplicate collapse: same level, code, message, and normalized cause.
      const samePayload =
        existing.input.level === raw.level &&
        existing.input.code === raw.code &&
        existing.input.message === raw.message &&
        sameCause(existing.normalizedCause, normalizedCause)
      if (samePayload) return
      // Same key, different normalized payload: drop both siblings and record
      // exactly one Velite-authored fatal prepare-conflict diagnostic.
      entries.delete(raw.key)
      entries.set(`__conflict__${raw.key}`, {
        input: { key: raw.key, level: 'error', code: 'PREPARE_CONFLICT', message: '' },
        normalizedCause: undefined,
        conflict: true
      })
      return
    }
    entries.set(raw.key, { input: raw, normalizedCause })
  }
  const diagnostics = (): readonly Diagnostic[] => {
    const out: Diagnostic[] = []
    for (const [, entry] of entries) {
      if (entry.conflict === true) {
        out.push(prepareConflictDiagnostic(entry.input.key))
        continue
      }
      // Construct the Diagnostic directly so the already-normalized cause is
      // not re-normalized (which would wrap the record in another record).
      const d: Diagnostic = {
        level: entry.input.level,
        code: entry.input.code,
        message: entry.input.message,
        stage: 'prepare',
        origin: { kind: 'prepare-hook', key: entry.input.key },
        provenance: { scope: 'project' },
        ...(entry.normalizedCause !== undefined ? { cause: entry.normalizedCause } : {})
      }
      out.push(d)
    }
    return out
  }
  const close = (): void => {
    closed = true
  }
  return {
    get diagnostics() {
      return diagnostics()
    },
    addDiagnostic,
    close
  }
}

/** Absolute path of the velite-owned manifest under the data output directory. */
const manifestPath = (config: ResolvedConfig): string => join(config.output.data, MANIFEST_FILENAME)

/** Persist the current data+asset manifest to disk so cross-process builds can reconcile. */
const persistManifest = async (context: RunContext): Promise<void> => {
  const manifest: OutputManifest = { files: context.manifest.files, assets: [...context.assetManifest] }
  await saveManifest(context.runtime.fs, manifestPath(context.config), manifest)
}

/** Remove every velite-tracked data file from the previous manifest, then reset it. */
const reconcileDataToEmpty = async (context: RunContext): Promise<void> => {
  for (const file of Object.keys(context.manifest.files)) await context.runtime.fs.remove(file)
  context.manifest = { files: {} }
}

/** Remove assets tracked in the previous manifest but absent from `desired`, then store `desired`. */
const reconcileAssetsTo = async (context: RunContext, desired: Set<string>): Promise<void> => {
  for (const dest of context.assetManifest) {
    if (!desired.has(dest)) await context.runtime.fs.remove(dest)
  }
  context.assetManifest = desired
}

/**
 * Build the prepare hook's friendly view of the output: collection name → data
 * array (list collections) or single data object (single collections). The
 * data values are live references into the entries, so mutating elements
 * propagates; pushing/splicing the array does not (the rebuild below catches
 * those length changes).
 */
const buildPrepareCollections = (output: LogicalOutput): PrepareCollections => {
  const collections: PrepareCollections = {}
  for (const [name, result] of Object.entries(output.collections)) {
    collections[name] = result.mode === 'single' ? result.entries[0]?.data : result.entries.map(e => e.data)
  }
  return collections
}

/**
 * Rebuild the {@link LogicalOutput} after the prepare hook ran, syncing the
 * (possibly mutated / replaced) collections back onto entries. Existing
 * entries keep their `id`/`source`; items beyond the original length get
 * synthetic ids; items removed (shorter array) drop. Single collections take
 * their single data object.
 */
const rebuildOutput = (output: LogicalOutput, collections: PrepareCollections): LogicalOutput => {
  const next: LogicalOutput['collections'] = {}
  for (const [name, result] of Object.entries(output.collections)) {
    const data = collections[name]
    if (result.mode === 'single') {
      // An empty single collection reports COLLECTION_EMPTY — a schema-stage
      // error, hence non-fatal — and can still receive data from the prepare
      // hook. Synthesize the entry the same way the list branch does instead
      // of spreading `undefined`.
      const existing = result.entries[0]
      const entries = data == null ? [] : [existing === undefined ? { id: `${name}#0` as const, source: '' as const, data } : { ...existing, data }]
      next[name] = { collection: name, mode: 'single', entries }
    } else {
      const arr = Array.isArray(data) ? data : []
      const entries = arr.map((item, i) => {
        const existing = result.entries[i]
        return existing === undefined ? { id: `${name}#${i}` as const, source: '', data: item } : { ...existing, data: item }
      })
      next[name] = { collection: name, mode: 'list', entries }
    }
  }
  return { collections: next }
}

/** Walk the content root and feed the tree snapshot as an engine input. */
const refreshTree = async (context: RunContext): Promise<TreeFile[]> => {
  const { engine, config, runtime } = context
  runtime.logger.debug(`building from '${config.root}'`)
  const include = [...new Set(config.collections.flatMap(c => c.include))]
  const exclude = [...new Set(config.collections.flatMap(c => c.exclude))]
  const absPaths = await runtime.fs.walk(config.root, { include, exclude })
  const tree: TreeFile[] = []
  for (const absPath of absPaths) {
    const stat = await runtime.fs.stat(absPath)
    tree.push({ path: relative(config.root, absPath), absPath, stat })
  }
  sortTree(tree)
  engine.set(TREE, tree)
  context.tree = tree
  runtime.logger.debug(`resolved ${tree.length} source files`)
  return tree
}

/** Read all current source files into engine inputs (full build). */
const readSources = async (context: RunContext): Promise<void> => {
  const { engine, pipeline, config, runtime } = context
  const seen = new Set<string>()
  const pool = createPool(8)
  const tasks: Promise<void>[] = []
  for (const col of config.collections) {
    const sources = await engine.get(pipeline.sources, col.name)
    for (const source of sources) {
      if (seen.has(source.path)) continue
      seen.add(source.path)
      tasks.push(
        pool.run(async () => {
          engine.set(fileInput(source.path), await runtime.fs.read(source.absPath))
        })
      )
    }
  }
  // Not pool.drain(): drain only waits for settlement — it drops rejections,
  // turning a failed read (file vanished between walk and read, permission
  // error) into an unhandled process crash. Promise.all propagates the first
  // failure while keeping handlers attached to every in-flight task.
  await Promise.all(tasks)
}

/**
 * Remember the last emit on the run context: the incremental-patch seed plus
 * the source → collections index patches use for routing.
 */
const rememberEmitted = (context: RunContext, emitted: Emitted): void => {
  context.lastEmitted = emitted
  const sourceCollections = new Map<string, Set<string>>()
  for (const [name, collection] of Object.entries(emitted.output.collections)) {
    for (const entry of collection.entries) {
      let collections = sourceCollections.get(entry.source)
      if (collections === undefined) {
        collections = new Set()
        sourceCollections.set(entry.source, collections)
      }
      collections.add(name)
    }
  }
  context.sourceCollections = sourceCollections
}

const hasUniqueEffect = (emitted: Emitted): boolean => emitted.effects.some(effect => effect.type === 'unique')

/**
 * Fatal (non-schema) errors make the output untrustworthy: throw a
 * `VeliteError` carrying the first fatal diagnostic's stage as its code and
 * its message as the error message, so catchers (CLI, watch) can print
 * something meaningful even without the diagnostic list.
 */
const throwIfFatal = (diagnostics: readonly Diagnostic[]): void => {
  const fatal = firstFatalDiagnostic(diagnostics)
  if (fatal !== undefined) {
    throw new VeliteError(fatal.stage as VeliteErrorCode, { message: fatal.message, diagnostics: [...diagnostics] })
  }
}

const tryPatchEmitted = async (context: RunContext): Promise<Emitted | undefined> => {
  const previous = context.lastEmitted
  const changedPaths = context.changedPaths
  if (previous === undefined || changedPaths === undefined || changedPaths.size === 0) return undefined
  if (context.config.prepare !== undefined || hasUniqueEffect(previous)) return undefined

  const collections: Emitted['output']['collections'] = { ...previous.output.collections }
  let effects = previous.effects
  // previous.diagnostics holds everything the last build reported: warn/info
  // plus schema-stage error diagnostics — the only error level that doesn't
  // throw before rememberEmitted records a build. Carry them forward instead
  // of disabling the patch; diagnostics owned by a patched source are dropped
  // below when that source is re-validated.
  const diagnostics: Emitted['diagnostics'] = [...previous.diagnostics]
  const patchedCollections = new Set<string>()

  for (const path of changedPaths) {
    const collectionNames = context.sourceCollections.get(path)
    if (collectionNames === undefined || collectionNames.size === 0) return undefined
    for (const collectionName of collectionNames) {
      const meta = context.config.collections.find(collection => collection.name === collectionName)
      if (meta === undefined || meta.single) return undefined
      const current = collections[collectionName]
      if (current === undefined || current.mode !== 'list') return undefined

      const validated = await context.engine.get(context.pipeline.validate, { collection: collectionName, path })
      // Error-level validation failures need the full re-emit path (empty
      // entries, reported diagnostics); warn/info can ride along with the
      // patch, matching what a full rebuild would report.
      if (validated.diagnostics.some(d => d.level === 'error') || validated.effects.some(effect => effect.type === 'unique')) return undefined
      // Drop the diagnostics the previous build attributed to this source —
      // the fresh validation above replaces them.
      for (let i = diagnostics.length - 1; i >= 0; i--) {
        const provenance = diagnostics[i]!.provenance
        if ((provenance.scope === 'source' || provenance.scope === 'record') && provenance.source.path === path) diagnostics.splice(i, 1)
      }
      diagnostics.push(...validated.diagnostics)

      const removedOwners = new Set<string>(current.entries.filter(entry => entry.source === path).map(entry => entry.id))
      const entries = current.entries.filter(entry => entry.source !== path)
      entries.push(...validated.entries)
      entries.sort((a, b) => compareStrings(a.id, b.id))
      collections[collectionName] = { ...current, entries }
      effects = effects.filter(effect => effect.system.collectionId !== collectionName || !removedOwners.has(effect.system.owner))
      effects.push(...validated.effects)
      patchedCollections.add(collectionName)
    }
  }

  context.patchedCollections = patchedCollections
  return { output: { collections }, effects, diagnostics }
}

/** Mutable asset-read state shared by the resolve and copy phases of one run. */
interface AssetReadSession {
  /** Bytes read so far, by assetKey — reused by the copy phase's writes. */
  readonly bytes: Map<string, Uint8Array>
  /** ASSET_FAILED read diagnostics, in read order. */
  readonly diagnostics: Diagnostic[]
}

/** The asset derivation demand an asset effect represents — the exact key the declaring schema used. */
const demandOf = (effect: AssetReferenceEffect): AssetKey => ({
  assetKey: effect.assetKey,
  template: effect.template,
  ...(effect.blur !== undefined ? { blur: effect.blur } : {}),
  ...(effect.metadata ? { metadata: true } : {})
})

/** Read asset bytes into `session`, recording one ASSET_FAILED diagnostic per unreadable path. */
const readAssetBytes = async (
  context: RunContext,
  session: AssetReadSession,
  assetKey: string,
  assetPath: string,
  feed?: (bytes: Uint8Array) => void
): Promise<void> => {
  try {
    const bytes = await context.runtime.fs.read(assetPath)
    session.bytes.set(assetKey, bytes)
    feed?.(bytes)
  } catch (err) {
    session.diagnostics.push(
      diagnostic('error', 'ASSET_FAILED', `failed to read asset: ${assetPath}`, {
        stage: 'asset',
        provenance: { scope: 'source', source: { path: relative(context.config.root, assetPath) } },
        cause: err
      })
    )
  }
}

/**
 * Resolve every distinct asset demand through the asset derivation. For
 * `s.file` / `s.image` references this is a memo hit on the schema's own
 * demand; declared-only references trigger the derivation's lazy read here.
 * An unresolved result means the bytes input is unset — the driver reads the
 * file and feeds the input so pass 2 can re-emit against real bytes.
 */
const resolveAssets = async (context: RunContext, emitted: Emitted): Promise<{ emitted: Emitted; session: AssetReadSession }> => {
  const { engine, pipeline, config } = context
  const session: AssetReadSession = { bytes: new Map(), diagnostics: [] }
  const demanded = new Map<string, AssetKey>()
  for (const effect of emitted.effects) {
    if (effect.type !== 'asset') continue
    const demand = demandOf(effect)
    demanded.set(JSON.stringify(demand), demand)
  }
  const unresolved = new Set<string>()
  await Promise.all(
    Array.from(demanded.values(), async demand => {
      const result = await engine.get(pipeline.asset, demand)
      if (!result.resolved) unresolved.add(demand.assetKey)
    })
  )
  await Promise.all(
    Array.from(unresolved, assetKey =>
      readAssetBytes(context, session, assetKey, join(config.root, assetKey), bytes => engine.set(assetInput(assetKey), bytes))
    )
  )
  // Pass 2: re-emit with real asset data (only when at least one asset was
  // fed; if every read failed, pass 2 would reproduce placeholders and the
  // fatal gate in emitAndWrite discards the output anyway).
  return { emitted: session.bytes.size > 0 ? await engine.get(pipeline.emit, null) : emitted, session }
}

/**
 * Apply the user-facing `prepare` hook between emit and any writes. The hook
 * sees a friendly `{ collections, diagnostics }` view (name → data array, or
 * single object) and may mutate in place (void), replace (new collections),
 * or suppress output (`false`). A `false` return means the caller takes over
 * output: velite writes nothing new AND reconciles its own previous output
 * (data + assets) to empty, so a prior successful build's files cannot be
 * served as current. Only velite-tracked files (the manifests) are removed;
 * caller-written files are left untouched.
 *
 * The sole prepare diagnostic channel is `addDiagnostic`. The legacy
 * `{ collections, diagnostics? }` return shape is removed; `prepare(false)`
 * records output suppression only and bypasses no fatal/strict/staging/
 * publication gate — fatal prepare diagnostics still surface in the returned
 * BuildResult.
 */
const runPrepareHook = async (
  context: RunContext,
  output: LogicalOutput,
  diagnostics: Diagnostic[]
): Promise<{ suppressed: true; result: BuildResult } | { suppressed: false; output: LogicalOutput; diagnostics: Diagnostic[] }> => {
  const { config, runtime } = context
  if (config.prepare === undefined) return { suppressed: false, output, diagnostics }
  const sink = createPrepareSink()
  const prepareContext: PrepareContext = {
    project: buildProjectInfo(config),
    diagnostics,
    addDiagnostic: sink.addDiagnostic
  }
  const view = buildPrepareCollections(output)
  let prepared: void | false | { readonly collections: PrepareCollections }
  try {
    prepared = await config.prepare(view, prepareContext)
  } finally {
    // Close the sink synchronously at hook settlement. Any later call to
    // addDiagnostic throws VeliteError('internal') and appends nothing.
    sink.close()
  }
  // Merge the sink's diagnostics into the build's diagnostics. The sink
  // is the sole prepare diagnostic channel; the return value no longer
  // carries `diagnostics`.
  const merged = [...diagnostics, ...sink.diagnostics]
  if (prepared === false) {
    runtime.logger.warn(`prevent output by 'prepare' callback`)
    await reconcileDataToEmpty(context)
    await reconcileAssetsTo(context, new Set())
    await persistManifest(context)
    runtime.logger.report(merged)
    // `prepare(false)` suppresses output only; it bypasses no fatal gate.
    // If the prepare hook (or earlier stages) produced a fatal diagnostic,
    // the build still fails with the appropriate VeliteError code, matching
    // the normal runBuild path.
    throwIfFatal(merged)
    return { suppressed: true, result: { output, diagnostics: merged, written: [] } }
  }
  // A void return means the hook mutated the view in place; a collections
  // return replaces it. Either way the logical output is rebuilt from the
  // resulting collections.
  const collections = prepared !== undefined ? prepared.collections : view
  return { suppressed: false, output: rebuildOutput(output, collections), diagnostics: merged }
}

/**
 * Copy referenced asset files into the assets output directory. Done before
 * the fatal gate so a write failure (full disk, permissions) surfaces as a
 * structured ASSET_FAILED diagnostic instead of a raw fs error — matching the
 * read-failure handling in resolveAssets. The destination comes from
 * re-demanding the asset derivation per distinct (assetKey, template) pair —
 * a memo hit that yields the same content-hashed public url the schemas
 * produced; the output name is the url with the base prefix stripped. Only
 * assets successfully read are written.
 */
const copyAssets = async (
  context: RunContext,
  emitted: Emitted,
  session: AssetReadSession
): Promise<{ written: string[]; desiredAssets: Set<string>; writeDiagnostics: Diagnostic[] }> => {
  const { engine, pipeline, config, runtime } = context
  const written: string[] = []
  const desiredAssets = new Set<string>()
  const writeDiagnostics: Diagnostic[] = []
  const assetsToWrite: Array<{ assetKey: string; dest: string }> = []
  const seenPairs = new Set<string>()
  for (const effect of emitted.effects) {
    if (effect.type !== 'asset') continue
    const pair = `${effect.assetKey}\u0000${effect.template}`
    if (seenPairs.has(pair)) continue
    seenPairs.add(pair)
    const result = await engine.get(pipeline.asset, demandOf(effect))
    const outputName = result.publicUrl.slice(config.output.base.length)
    if (outputName.length === 0) continue
    const dest = join(config.output.assets, outputName)
    if (desiredAssets.has(dest)) continue
    desiredAssets.add(dest)
    if (context.assetManifest.has(dest)) continue
    assetsToWrite.push({ assetKey: effect.assetKey, dest })
  }

  // The resolve phase only reads bytes for unresolved assets; ones that
  // resolved via the derivation's lazy disk read are not in the session yet.
  // Read those here so every planned write has bytes.
  await Promise.all(
    Array.from(new Set(assetsToWrite.map(a => a.assetKey)), assetKey =>
      session.bytes.has(assetKey) ? undefined : readAssetBytes(context, session, assetKey, join(config.root, assetKey))
    )
  )

  const assetWrites: Promise<void>[] = []
  for (const { assetKey, dest } of assetsToWrite) {
    const bytes = session.bytes.get(assetKey)
    if (bytes === undefined) continue
    assetWrites.push(
      runtime.fs.write(dest, bytes).then(
        () => {
          written.push(dest)
        },
        err => {
          desiredAssets.delete(dest)
          writeDiagnostics.push(
            diagnostic('error', 'ASSET_FAILED', `failed to write asset: ${dest}`, {
              stage: 'asset',
              provenance: { scope: 'source', source: { path: assetKey } },
              cause: err
            })
          )
        }
      )
    )
  }
  await Promise.all(assetWrites)
  return { written, desiredAssets, writeDiagnostics }
}

/**
 * Run the emit pipeline, apply the prepare hook, write data + assets, reconcile.
 *
 * Two passes: emit is first demanded against placeholder asset urls to
 * discover asset references; the driver then feeds each referenced asset's
 * bytes as `asset:<key>` inputs and re-demands emit (pass 2) so the asset
 * derivation — and everything downstream — recomputes with real probe results
 * and content-hashed urls. Diagnostics are reported, the data output is
 * written (unchanged files skipped), and referenced asset files are copied
 * into the assets output directory. Asset read/write failures become fatal
 * `ASSET_FAILED` diagnostics rather than crashing the build.
 */
const emitAndWrite = async (context: RunContext, layout: 'split' | 'single', patched?: Emitted): Promise<BuildResult> => {
  const { engine, pipeline, runtime } = context

  // Pass 1: discover asset references via the schema parse, then resolve the
  // asset demands (feeding unresolved inputs re-emits as pass 2).
  let emitted = patched ?? (await engine.get(pipeline.emit, null))
  for (const [name, collection] of Object.entries(emitted.output.collections)) {
    runtime.logger.debug(`resolved ${collection.entries.length} ${name}`)
  }
  const resolved = await resolveAssets(context, emitted)
  emitted = resolved.emitted

  // Diagnostics known before the prepare hook: schema/unique (from emit) +
  // asset read failures. Asset *write* failures happen during the copy below.
  const assetReadDiagnosticCount = resolved.session.diagnostics.length
  let diagnostics = [...emitted.diagnostics, ...resolved.session.diagnostics]

  const prepared = await runPrepareHook(context, emitted.output, diagnostics)
  if (prepared.suppressed) return prepared.result
  let output = prepared.output
  diagnostics = prepared.diagnostics

  const copied = await copyAssets(context, emitted, resolved.session)
  // copyAssets can append further read failures to the session (bytes it had
  // to read itself); take only those new entries to avoid duplicating the
  // ones already merged above.
  diagnostics = [...diagnostics, ...resolved.session.diagnostics.slice(assetReadDiagnosticCount), ...copied.writeDiagnostics]

  const finalDiagnostics = diagnostics
  runtime.logger.report(finalDiagnostics)
  // Fatal (non-schema) errors make the output untrustworthy: report and throw,
  // skipping the write. Schema-level errors are non-fatal and returned in the result.
  throwIfFatal(finalDiagnostics)
  const {
    written: dataWritten,
    manifest,
    entryJsonCache: updatedCache
  } = await writeOutput(
    output,
    {
      fs: runtime.fs,
      dir: context.config.output.data,
      layout,
      configPath: context.config.configPath,
      collections: context.config.collections,
      format: context.config.output.format,
      pretty: layout === 'split',
      changedCollections: patched === undefined ? undefined : context.patchedCollections,
      changedSources: patched === undefined ? undefined : context.changedPaths,
      entryJsonCache: context.entryJsonCache
    },
    context.manifest
  )
  context.manifest = manifest
  context.entryJsonCache = updatedCache
  rememberEmitted(context, { output, effects: emitted.effects, diagnostics: finalDiagnostics })
  const written = [...copied.written, ...dataWritten]
  const dataFileCount = Object.keys(output.collections).length
  runtime.logger.debug(`output ${dataFileCount} data ${dataFileCount === 1 ? 'file' : 'files'}`)
  runtime.logger.debug(`wrote ${written.length} output ${written.length === 1 ? 'file' : 'files'}`)

  // Reconcile asset output after a successful commit: drop orphaned hashed
  // assets from the previous run, then record the current desired set.
  await reconcileAssetsTo(context, copied.desiredAssets)
  await persistManifest(context)

  return { output, diagnostics: finalDiagnostics, written }
}

/** Execute one full build run: I/O in, pure pipeline, I/O out. */
const runBuild = async (context: RunContext, layout: 'split' | 'single' = 'split'): Promise<BuildResult> => {
  await refreshTree(context)
  await readSources(context)
  context.changedPaths = undefined
  return emitAndWrite(context, layout)
}

/** Re-emit after inputs were patched (incremental). Skips full tree walk and bulk read. */
const runIncremental = async (context: RunContext, layout: 'split' | 'single' = 'split'): Promise<BuildResult> => {
  try {
    const patched = await tryPatchEmitted(context)
    return await emitAndWrite(context, layout, patched)
  } finally {
    // Consume the patch hints even when the run fails: a stale
    // changedPaths/patchedCollections pair must never steer a later patch.
    context.changedPaths = undefined
    context.patchedCollections = undefined
  }
}

/**
 * Apply file events to engine inputs. Returns whether a config reload, content
 * rebuild, or no action is needed.
 */
const applyChanges = async (context: RunContext, events: FileEvent[]): Promise<ApplyResult> => {
  const { engine, config, runtime } = context
  let configReload = false
  let content = false
  let changedPaths: Set<string> | undefined = new Set()
  let treeChanged = false

  const classify = createEventClassifier({
    configPath: config.configPath,
    configDependencies: config.configDependencies,
    contentRoot: config.root,
    outputDir: config.output.data,
    assetsDir: config.output.assets
  })

  for (const event of events) {
    const kind = classify(event)
    if (kind === 'ignore') continue
    if (kind === 'config') {
      runtime.logger.info(`config changed: '${event.absPath}', reloading...`)
      configReload = true
      continue
    }
    runtime.logger.info(`changed: '${event.absPath}', rebuilding...`)

    const rel = relative(config.root, event.absPath)
    if (rel.startsWith('..')) continue
    // The asset input key must match what the schema demands (assetKeyOf uses
    // posix.relative). For posix hosts this equals `rel`; computing it via
    // assetKeyOf keeps the key consistent across non-posix Path implementations.
    const assetKey = assetKeyOf(event.absPath, config.root)

    if (event.type === 'unlink') {
      engine.remove(fileInput(rel))
      engine.remove(assetInput(assetKey))
      context.tree = context.tree.filter(f => f.path !== rel)
      content = true
      changedPaths = undefined
      treeChanged = true
      continue
    }

    try {
      const stat = await runtime.fs.stat(event.absPath)
      const entry: TreeFile = { path: rel, absPath: event.absPath, stat }
      const index = context.tree.findIndex(f => f.path === rel)
      if (index >= 0) context.tree[index] = entry
      else {
        context.tree.push(entry)
        sortTree(context.tree)
        treeChanged = true
      }
      const bytes = await runtime.fs.read(event.absPath)
      engine.set(fileInput(rel), bytes)
      // Feed the asset input too: the file may be an asset source referenced by
      // a schema. Over-inclusive but correct — unused inputs are never demanded.
      engine.set(assetInput(assetKey), bytes)
      if (changedPaths !== undefined && event.type === 'change') changedPaths.add(rel)
      else changedPaths = undefined
      content = true
    } catch {
      // Race: file disappeared between event and read — treat as unlink.
      engine.remove(fileInput(rel))
      engine.remove(assetInput(assetKey))
      context.tree = context.tree.filter(f => f.path !== rel)
      content = true
      changedPaths = undefined
      treeChanged = true
    }
  }

  if (treeChanged) engine.set(TREE, context.tree)
  context.changedPaths = content ? changedPaths : undefined
  if (configReload) return 'config-reload'
  if (content) return 'content'
  return 'none'
}

/**
 * Create a fresh run context. Loads the previous build's manifest from
 * `output.data/.manifest.json` so that one-shot `build()` invocations across
 * processes can still reconcile stale data and orphan asset copies. Loaded
 * paths are validated against the configured output roots — any entry outside
 * `output.data` / `output.assets` is dropped, so a corrupted/tampered manifest
 * can never make the next build delete files Velite did not write.
 */
export const createRunContext = async ({ engine, pipeline, config, runtime }: RunContextDeps): Promise<RunContext> => {
  const persisted = await loadManifest(runtime.fs, join(config.output.data, MANIFEST_FILENAME), config.output.data, config.output.assets)
  return {
    engine,
    pipeline,
    config,
    runtime,
    tree: [],
    manifest: { files: persisted.files },
    assetManifest: new Set(persisted.assets),
    sourceCollections: new Map(),
    entryJsonCache: { jsons: new Map(), digests: new Map() }
  }
}

export const createDriver = ({ context }: DriverDeps): Driver => ({
  runBuild: layout => runBuild(context, layout),
  runIncremental: layout => runIncremental(context, layout),
  applyChanges: events => applyChanges(context, events)
})
