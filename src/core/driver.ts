import { classifyEvent } from './classify'
import { codeFromDiagnostics, diagnostic, hasFatalDiagnostic, VeliteError } from './diagnostic'
import { emptyManifest } from './output/manifest'
import { writeOutput } from './output/writer'
import { assetInput, assetKeyOf, fileInput, TREE } from './pipeline'
import { createPool } from './util/pool'

import type { Runtime } from '../runtime'
import type { FileEvent } from '../runtime/watcher'
import type { PrepareContext, ResolvedConfig } from './config'
import type { Diagnostic } from './diagnostic'
import type { Engine } from './engine'
import type { LogicalOutput } from './output/logical'
import type { OutputManifest } from './output/manifest'
import type { Pipeline, TreeFile } from './pipeline'

export interface RunContext {
  engine: Engine
  pipeline: Pipeline
  config: ResolvedConfig
  runtime: Runtime
  /** Shadow copy of the tree input, kept in sync with the engine. */
  tree: TreeFile[]
  manifest: OutputManifest
}

export interface BuildResult {
  output: LogicalOutput
  diagnostics: Diagnostic[]
  /** Output files written this run. */
  written: string[]
}

export type ApplyResult = 'config-reload' | 'content' | 'none'

const sortTree = (tree: TreeFile[]): TreeFile[] => tree.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

/** Walk the content root and feed the tree snapshot as an engine input. */
export const refreshTree = async (context: RunContext): Promise<TreeFile[]> => {
  const { engine, config, runtime } = context
  const include = [...new Set(config.collections.flatMap(c => c.include))]
  const exclude = [...new Set(config.collections.flatMap(c => c.exclude))]
  const absPaths = await runtime.fs.walk(config.root, { include, exclude })
  const tree: TreeFile[] = []
  for (const absPath of absPaths) {
    const stat = await runtime.fs.stat(absPath)
    tree.push({ path: runtime.path.relative(config.root, absPath), absPath, stat })
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
  // may mutate/replace the logical output + diagnostics, or return `false` to
  // suppress all output (data + assets). Runs before the asset copy so `false`
  // genuinely writes nothing.
  let output: LogicalOutput = emitted.output
  if (config.prepare !== undefined) {
    const prepareContext: PrepareContext = {
      project: { root: config.root, configPath: config.configPath, collections: config.collections },
      diagnostics
    }
    const prepared = await config.prepare({ output, diagnostics }, prepareContext)
    if (prepared === false) {
      runtime.logger?.report?.(diagnostics)
      return { output, diagnostics, written: [] }
    }
    if (prepared !== undefined) {
      output = prepared.output
      diagnostics = prepared.diagnostics
    }
  }

  // Copy referenced asset files into the assets output directory. Done before
  // the fatal gate so a write failure (full disk, permissions) surfaces as a
  // structured ASSET_FAILED diagnostic instead of a raw fs error — matching the
  // read-failure handling above. The final (content-hashed) public url is in
  // pass 2's effects; the output name is the url with the base prefix stripped.
  // Only assets successfully read are written.
  const written: string[] = []
  const writtenAssets = new Set<string>()
  const assetWriteDiagnostics: Diagnostic[] = []
  for (const effect of emitted.effects) {
    if (effect.type !== 'asset') continue
    const assetKey = assetKeyOf(effect.assetPath, config.root)
    const bytes = assetBytes.get(assetKey)
    if (bytes === undefined) continue
    const outputName = effect.publicUrl.slice(config.output.base.length)
    if (outputName.length === 0 || writtenAssets.has(outputName)) continue
    writtenAssets.add(outputName)
    const dest = runtime.path.join(config.output.assets, outputName)
    try {
      await runtime.fs.write(dest, bytes)
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
  runtime.logger?.report?.(finalDiagnostics)
  // Fatal (non-schema) errors make the output untrustworthy: report and throw,
  // skipping the write. Schema-level errors are non-fatal and returned in the result.
  if (hasFatalDiagnostic(finalDiagnostics)) {
    throw new VeliteError(codeFromDiagnostics(finalDiagnostics), { diagnostics: finalDiagnostics })
  }

  const { written: dataWritten, manifest } = await writeOutput(
    output,
    {
      fs: runtime.fs,
      path: runtime.path,
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
export const applyChanges = async (context: RunContext, events: FileEvent[], options: { cwd: string; configPath: string }): Promise<ApplyResult> => {
  const { engine, config, runtime } = context
  let configReload = false
  let content = false

  const classifyOpts = {
    cwd: options.cwd,
    configPath: options.configPath,
    contentRoot: config.root,
    outputDir: config.output.data,
    path: runtime.path
  }

  for (const event of events) {
    const kind = classifyEvent(event, classifyOpts)
    if (kind === 'ignore') continue
    if (kind === 'config') {
      configReload = true
      continue
    }

    const rel = runtime.path.relative(config.root, event.absPath)
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

/** Create a fresh run context (empty tree/manifest). */
export const createRunContext = (engine: Engine, pipeline: Pipeline, config: ResolvedConfig, runtime: Runtime): RunContext => ({
  engine,
  pipeline,
  config,
  runtime,
  tree: [],
  manifest: emptyManifest()
})
