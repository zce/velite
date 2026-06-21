import { classifyEvent } from './classify'
import { codeFromDiagnostics, diagnostic, hasFatalDiagnostic, VeliteError } from './diagnostic'
import { emptyManifest } from './output/manifest'
import { writeOutput } from './output/writer'
import { assetInput, assetKeyOf, fileInput, TREE } from './pipeline'

import type { ResolvedConfig } from './config'
import type { Diagnostic } from './diagnostic'
import type { Engine } from './engine'
import type { Host } from './host'
import type { FileEvent } from './host/watcher'
import type { LogicalOutput } from './output/logical'
import type { OutputManifest } from './output/manifest'
import type { Pipeline, TreeFile } from './pipeline'

export interface RunContext {
  engine: Engine
  pipeline: Pipeline
  config: ResolvedConfig
  host: Host
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
  const { engine, config, host } = context
  const include = [...new Set(config.collections.flatMap(c => c.include))]
  const exclude = [...new Set(config.collections.flatMap(c => c.exclude))]
  const absPaths = await host.fs.walk(config.root, { include, exclude })
  const tree: TreeFile[] = []
  for (const absPath of absPaths) {
    const stat = await host.fs.stat(absPath)
    tree.push({ path: host.path.relative(config.root, absPath), absPath, stat })
  }
  sortTree(tree)
  engine.set(TREE, tree)
  context.tree = tree
  return tree
}

/** Read all current source files into engine inputs (full build). */
export const readSources = async (context: RunContext): Promise<void> => {
  const { engine, pipeline, config, host } = context
  const seen = new Set<string>()
  for (const col of config.collections) {
    const sources = await engine.get(pipeline.sources, col.name)
    for (const source of sources) {
      if (seen.has(source.path)) continue
      seen.add(source.path)
      engine.set(fileInput(source.path), await host.fs.read(source.absPath))
    }
  }
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
const emitAndWrite = async (context: RunContext): Promise<BuildResult> => {
  const { engine, pipeline, config, host } = context

  // Pass 1: discover asset references via the schema parse.
  let emitted = await engine.get(pipeline.emit, null)

  // Collect unique asset references (by assetKey) and feed their bytes.
  const assetBytes = new Map<string, Uint8Array>()
  const assetDiagnostics: Diagnostic[] = []
  const seenKeys = new Set<string>()
  for (const effect of emitted.effects) {
    if (effect.type !== 'asset') continue
    const assetKey = assetKeyOf(effect.assetPath, config.root)
    if (seenKeys.has(assetKey)) continue
    seenKeys.add(assetKey)
    try {
      const bytes = await host.fs.read(effect.assetPath)
      assetBytes.set(assetKey, bytes)
      engine.set(assetInput(assetKey), bytes)
    } catch (err) {
      assetDiagnostics.push(
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

  // Copy referenced asset files into the assets output directory. Done before
  // the fatal gate so a write failure (full disk, permissions) surfaces as a
  // structured ASSET_FAILED diagnostic instead of a raw fs error — matching the
  // read-failure handling above. The final (content-hashed) public url is in
  // pass 2's effects; the output name is the url with the base prefix stripped.
  // Only assets successfully read are written.
  const written: string[] = []
  const writtenAssets = new Set<string>()
  for (const effect of emitted.effects) {
    if (effect.type !== 'asset') continue
    const assetKey = assetKeyOf(effect.assetPath, config.root)
    const bytes = assetBytes.get(assetKey)
    if (bytes === undefined) continue
    const outputName = effect.publicUrl.slice(config.output.base.length)
    if (outputName.length === 0 || writtenAssets.has(outputName)) continue
    writtenAssets.add(outputName)
    const dest = host.path.join(config.output.assets, outputName)
    try {
      await host.fs.write(dest, bytes)
      written.push(dest)
    } catch (err) {
      assetDiagnostics.push(
        diagnostic('error', 'ASSET_FAILED', `failed to write asset: ${dest}`, {
          stage: 'asset',
          file: effect.assetPath,
          cause: err
        })
      )
    }
  }

  const diagnostics = [...emitted.diagnostics, ...assetDiagnostics]
  host.logger?.report?.(diagnostics)
  // Fatal (non-schema) errors make the output untrustworthy: report and throw,
  // skipping the write. Schema-level errors are non-fatal and returned in the result.
  if (hasFatalDiagnostic(diagnostics)) {
    throw new VeliteError(codeFromDiagnostics(diagnostics), { diagnostics })
  }

  const { written: dataWritten, manifest } = await writeOutput(
    emitted.output,
    {
      fs: host.fs,
      path: host.path,
      dir: config.output.data
    },
    context.manifest
  )
  context.manifest = manifest
  written.push(...dataWritten)

  return { output: emitted.output, diagnostics, written }
}

/** Execute one full build run: I/O in, pure pipeline, I/O out. */
export const runBuild = async (context: RunContext): Promise<BuildResult> => {
  await refreshTree(context)
  await readSources(context)
  return emitAndWrite(context)
}

/** Re-emit after inputs were patched (incremental). Skips full tree walk and bulk read. */
export const runIncremental = async (context: RunContext): Promise<BuildResult> => emitAndWrite(context)

/**
 * Apply file events to engine inputs. Returns whether a config reload, content
 * rebuild, or no action is needed.
 */
export const applyChanges = async (context: RunContext, events: FileEvent[], options: { cwd: string; configPath: string }): Promise<ApplyResult> => {
  const { engine, config, host } = context
  let configReload = false
  let content = false

  const classifyOpts = {
    cwd: options.cwd,
    configPath: options.configPath,
    contentRoot: config.root,
    outputDir: config.output.data,
    path: host.path
  }

  for (const event of events) {
    const kind = classifyEvent(event, classifyOpts)
    if (kind === 'ignore') continue
    if (kind === 'config') {
      configReload = true
      continue
    }

    const rel = host.path.relative(config.root, event.absPath)
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
      const stat = await host.fs.stat(event.absPath)
      const entry: TreeFile = { path: rel, absPath: event.absPath, stat }
      const index = context.tree.findIndex(f => f.path === rel)
      if (index >= 0) context.tree[index] = entry
      else context.tree.push(entry)
      sortTree(context.tree)
      engine.set(TREE, context.tree)
      const bytes = await host.fs.read(event.absPath)
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
export const createRunContext = (engine: Engine, pipeline: Pipeline, config: ResolvedConfig, host: Host): RunContext => ({
  engine,
  pipeline,
  config,
  host,
  tree: [],
  manifest: emptyManifest()
})
