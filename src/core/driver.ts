import { classifyEvent } from './classify'
import { codeFromDiagnostics, hasFatalDiagnostic, VeliteError } from './diagnostic'
import { emptyManifest } from './output/manifest'
import { writeOutput } from './output/writer'
import { fileInput, TREE } from './pipeline'

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

const emitAndWrite = async (context: RunContext): Promise<BuildResult> => {
  const { engine, pipeline, config, host } = context
  const emitted = await engine.get(pipeline.emit, null)
  const diagnostics = emitted.diagnostics
  host.logger?.report?.(diagnostics)
  // Fatal (non-schema) errors make the output untrustworthy: report and throw,
  // skipping the write. Schema-level errors are non-fatal and returned in the result.
  if (hasFatalDiagnostic(diagnostics)) {
    throw new VeliteError(codeFromDiagnostics(diagnostics), { diagnostics })
  }
  const { written, manifest } = await writeOutput(
    emitted.output,
    {
      fs: host.fs,
      path: host.path,
      dir: config.output.data
    },
    context.manifest
  )
  context.manifest = manifest
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

    if (event.type === 'unlink') {
      engine.remove(fileInput(rel))
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
      engine.set(fileInput(rel), await host.fs.read(event.absPath))
      content = true
    } catch {
      // Race: file disappeared between event and read — treat as unlink.
      engine.remove(fileInput(rel))
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
