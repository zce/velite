import { classifyEvent } from './classify'
import { codeFromDiagnostics, diagnostic, hasFatalDiagnostic, VeliteError } from './diagnostic'
import { loadManifest, MANIFEST_FILENAME, saveManifest } from './output/manifest'
import { writeOutput } from './output/writer'
import { assetInput, assetKeyOf, buildProjectInfo, fileInput, TREE } from './pipeline'
import { join, relative } from './util/path'
import { createPool } from './util/pool'

import type { FileSystem } from '../runtime/fs'
import type { Logger } from '../runtime/logger'
import type { FileEvent } from '../runtime/watcher'
import type { PrepareCollections, PrepareContext, ResolvedConfig } from './config'
import type { Diagnostic } from './diagnostic'
import type { Engine } from './engine'
import type { LogicalOutput } from './output/logical'
import type { DataManifest, OutputManifest } from './output/manifest'
import type { Pipeline, TreeFile } from './pipeline'

/**
 * Runtime capabilities the driver actually touches at build time. Stated
 * explicitly so this layer doesn't pull in `modules`/`image`/`watch` (those
 * belong to config loading, asset derivation, and the watch loop respectively).
 */
export interface DriverRuntime {
  fs: FileSystem
  logger?: Logger
}

export interface RunContext {
  engine: Engine
  pipeline: Pipeline
  config: ResolvedConfig
  runtime: DriverRuntime
  /** Project working directory (where the user runs velite). */
  cwd: string
  /** Shadow copy of the tree input, kept in sync with the engine. */
  tree: TreeFile[]
  manifest: DataManifest
  /** Asset dest paths written in the previous successful run (reconcile set). */
  assetManifest: Set<string>
}

export interface BuildResult {
  output: LogicalOutput
  diagnostics: Diagnostic[]
  /** Output files written this run. */
  written: string[]
}

export type ApplyResult = 'config-reload' | 'content' | 'none'

const sortTree = (tree: TreeFile[]): TreeFile[] => tree.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

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
      const entries = data == null ? [] : [{ ...result.entries[0]!, data }]
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
export const refreshTree = async (context: RunContext): Promise<TreeFile[]> => {
  const { engine, config, runtime } = context
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
  return tree
}

/** Read all current source files into engine inputs (full build). */
export const readSources = async (context: RunContext): Promise<void> => {
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
  await pool.drain()
}

/**
 * Two-pass emit + write.
 *
 * Pass 1 demands emit to discover asset references (schema parses complete
 * against placeholder asset urls). The driver then reads each referenced
 * asset's bytes and feeds them as `asset:<key>` inputs. Pass 2 re-demands emit
 * so the asset derivation (and everything downstream) recomputes with real
 * probe results and content-hashed urls. Then diagnostics are reported, the
 * data output is written (unchanged), and referenced asset files are copied
 * into the assets output directory.
 *
 * Asset read failures become fatal `ASSET_FAILED` diagnostics rather than
 * crashing the build.
 */
const emitAndWrite = async (context: RunContext, layout: 'split' | 'single'): Promise<BuildResult> => {
  const { engine, pipeline, config, runtime } = context

  // Pass 1: discover asset references via the schema parse.
  let emitted = await engine.get(pipeline.emit, null)

  // Collect unique asset references (by assetKey) and feed their bytes.
  const assetBytes = new Map<string, Uint8Array>()
  const assetReadDiagnostics: Diagnostic[] = []
  const seenKeys = new Set<string>()
  for (const effect of emitted.effects) {
    if (effect.type !== 'asset') continue
    const assetKey = assetKeyOf(effect.assetPath, config.root)
    if (seenKeys.has(assetKey)) continue
    seenKeys.add(assetKey)
    try {
      const bytes = await runtime.fs.read(effect.assetPath)
      assetBytes.set(assetKey, bytes)
      engine.set(assetInput(assetKey), bytes)
    } catch (err) {
      assetReadDiagnostics.push(
        diagnostic('error', 'ASSET_FAILED', `failed to read asset: ${effect.assetPath}`, {
          stage: 'asset',
          file: effect.assetPath,
          cause: err
        })
      )
    }
  }

  // Pass 2: re-emit with real asset data (only when at least one asset was fed;
  // if every read failed, pass 2 would reproduce placeholders and the fatal
  // diagnostics below discard the output anyway).
  if (assetBytes.size > 0) {
    emitted = await engine.get(pipeline.emit, null)
  }

  // Diagnostics known before the prepare hook: schema/unique (from emit) + asset
  // read failures. Asset *write* failures happen during the copy below.
  let diagnostics = [...emitted.diagnostics, ...assetReadDiagnostics]

  // Apply the user-facing `prepare` hook between emit and any writes. The hook
  // sees a friendly `{ collections, diagnostics }` view (name → data array, or
  // single object) and may mutate in place (void), replace (new collections),
  // or suppress output (`false`). A `false` return means the caller takes over
  // output: velite writes nothing new AND reconciles its own previous output
  // (data + assets) to empty, so a prior successful build's files cannot be
  // served as current. Only velite-tracked files (the manifests) are removed;
  // caller-written files are left untouched.
  let output: LogicalOutput = emitted.output
  if (config.prepare !== undefined) {
    const prepareContext: PrepareContext = {
      project: buildProjectInfo(config),
      diagnostics
    }
    const view = buildPrepareCollections(output)
    const prepared = await config.prepare(view, prepareContext)
    if (prepared === false) {
      await reconcileDataToEmpty(context)
      await reconcileAssetsTo(context, new Set())
      await persistManifest(context)
      runtime.logger?.report(diagnostics)
      return { output, diagnostics, written: [] }
    }
    if (prepared !== undefined) {
      output = rebuildOutput(output, prepared.collections)
      if (prepared.diagnostics !== undefined) diagnostics = prepared.diagnostics
    } else {
      output = rebuildOutput(output, view)
    }
  }

  // Copy referenced asset files into the assets output directory. Done before
  // the fatal gate so a write failure (full disk, permissions) surfaces as a
  // structured ASSET_FAILED diagnostic instead of a raw fs error — matching the
  // read-failure handling above. The final (content-hashed) public url is in
  // pass 2's effects; the output name is the url with the base prefix stripped.
  // Only assets successfully read are written.
  const written: string[] = []
  const desiredAssets = new Set<string>()
  const assetWriteDiagnostics: Diagnostic[] = []
  for (const effect of emitted.effects) {
    if (effect.type !== 'asset') continue
    const assetKey = assetKeyOf(effect.assetPath, config.root)
    const bytes = assetBytes.get(assetKey)
    if (bytes === undefined) continue
    const outputName = effect.publicUrl.slice(config.output.base.length)
    if (outputName.length === 0) continue
    const dest = join(config.output.assets, outputName)
    if (desiredAssets.has(dest)) continue
    try {
      await runtime.fs.write(dest, bytes)
      desiredAssets.add(dest)
      written.push(dest)
    } catch (err) {
      assetWriteDiagnostics.push(
        diagnostic('error', 'ASSET_FAILED', `failed to write asset: ${dest}`, {
          stage: 'asset',
          file: effect.assetPath,
          cause: err
        })
      )
    }
  }

  const finalDiagnostics = [...diagnostics, ...assetWriteDiagnostics]
  runtime.logger?.report(finalDiagnostics)
  // Fatal (non-schema) errors make the output untrustworthy: report and throw,
  // skipping the write. Schema-level errors are non-fatal and returned in the result.
  if (hasFatalDiagnostic(finalDiagnostics)) {
    throw new VeliteError(codeFromDiagnostics(finalDiagnostics), { diagnostics: finalDiagnostics })
  }

  const { written: dataWritten, manifest } = await writeOutput(
    output,
    {
      fs: runtime.fs,
      dir: config.output.data,
      layout,
      configPath: config.configPath,
      collections: config.collections,
      format: config.output.format,
      pretty: layout === 'split'
    },
    context.manifest
  )
  context.manifest = manifest
  written.push(...dataWritten)

  // Reconcile asset output after a successful commit: drop orphaned hashed
  // assets from the previous run, then record the current desired set.
  await reconcileAssetsTo(context, desiredAssets)
  await persistManifest(context)

  return { output, diagnostics: finalDiagnostics, written }
}

/** Execute one full build run: I/O in, pure pipeline, I/O out. */
export const runBuild = async (context: RunContext, layout: 'split' | 'single' = 'split'): Promise<BuildResult> => {
  await refreshTree(context)
  await readSources(context)
  return emitAndWrite(context, layout)
}

/** Re-emit after inputs were patched (incremental). Skips full tree walk and bulk read. */
export const runIncremental = async (context: RunContext, layout: 'split' | 'single' = 'split'): Promise<BuildResult> => emitAndWrite(context, layout)

/**
 * Apply file events to engine inputs. Returns whether a config reload, content
 * rebuild, or no action is needed.
 */
export const applyChanges = async (context: RunContext, events: FileEvent[]): Promise<ApplyResult> => {
  const { engine, config, runtime } = context
  let configReload = false
  let content = false

  const classifyOpts = {
    cwd: context.cwd,
    configPath: config.configPath,
    contentRoot: config.root,
    outputDir: config.output.data,
    assetsDir: config.output.assets
  }

  for (const event of events) {
    const kind = classifyEvent(event, classifyOpts)
    if (kind === 'ignore') continue
    if (kind === 'config') {
      configReload = true
      continue
    }

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
      continue
    }

    try {
      const stat = await runtime.fs.stat(event.absPath)
      const entry: TreeFile = { path: rel, absPath: event.absPath, stat }
      const index = context.tree.findIndex(f => f.path === rel)
      if (index >= 0) context.tree[index] = entry
      else context.tree.push(entry)
      sortTree(context.tree)
      engine.set(TREE, context.tree)
      const bytes = await runtime.fs.read(event.absPath)
      engine.set(fileInput(rel), bytes)
      // Feed the asset input too: the file may be an asset source referenced by
      // a schema. Over-inclusive but correct — unused inputs are never demanded.
      engine.set(assetInput(assetKey), bytes)
      content = true
    } catch {
      // Race: file disappeared between event and read — treat as unlink.
      engine.remove(fileInput(rel))
      engine.remove(assetInput(assetKey))
      context.tree = context.tree.filter(f => f.path !== rel)
      engine.set(TREE, context.tree)
      content = true
    }
  }

  if (content) engine.set(TREE, context.tree)
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
export const createRunContext = async (
  engine: Engine,
  pipeline: Pipeline,
  config: ResolvedConfig,
  runtime: DriverRuntime,
  cwd: string
): Promise<RunContext> => {
  const persisted = await loadManifest(runtime.fs, join(config.output.data, MANIFEST_FILENAME), config.output.data, config.output.assets)
  return {
    engine,
    pipeline,
    config,
    runtime,
    cwd,
    tree: [],
    manifest: { files: persisted.files },
    assetManifest: new Set(persisted.assets)
  }
}
