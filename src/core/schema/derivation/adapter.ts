// Dialect adapters for the record-scoped content derivation module.
//
// Each adapter implements the {@link ContentDialectAdapter} contract:
//   - `parse(input)` runs the pristine parse using one internal path-aware
//     parse VFile and produces an opaque {@link PristineArtifact}
//     `{ tree, fileSeed, text }`. The parse VFile never enters a
//     transforming branch.
//   - `materializeBranch(artifact)` produces a fresh branch tree + VFile
//     materialized from the seed. The branch VFile restores the original
//     selected text as its initial value, reconstructs path state from a
//     fresh copy of history + cwd, receives a fresh independently-copied
//     data root, and a fresh messages array with the parse messages copied
//     exactly once before its own.
//   - `readPristineTree(artifact)` returns the opaque pristine tree for
//     static projections (no branch VFile, no returned transformers).
//
// Internal — not exported from any public barrel.

import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { VFile } from 'vfile'
import { VFileMessage } from 'vfile-message'

import { cloneSupportedData, MESSAGE_FIELDS, snapshotSeed } from './seed'

import type { Root as Mdast } from 'mdast'
import type { PluggableList } from 'unified'
import type { VFile as VFileType } from 'vfile'
import type { VFileSeed } from './seed'

/** Opaque pristine tree (mdast Root). */
export type OpaquePristineTree = Mdast

/** Opaque branch tree (a fresh structural clone of the pristine tree). */
export type OpaqueBranchTree = Mdast

/** The pristine artifact retained by a fulfilled parse slot. */
export interface PristineArtifact {
  readonly tree: OpaquePristineTree
  readonly fileSeed: VFileSeed
  /** The original selected text; restored as the branch VFile's initial value. */
  readonly text: string
}

/** A materialized transforming branch. */
export interface ContentBranch {
  readonly tree: OpaqueBranchTree
  readonly file: VFileType
}

/** The input to a pristine parse. */
export interface ParseInput {
  readonly text: string
  readonly path: string
  readonly cwd: string
  readonly gfm: boolean
  readonly removeComments: boolean
  readonly remarkPlugins: PluggableList
}

/** The dialect adapter contract. */
export interface ContentDialectAdapter {
  readonly dialect: 'markdown' | 'mdx'
  /** Run the pristine parse; produce the opaque pristine artifact. */
  parse(input: ParseInput): Promise<PristineArtifact>
  /** Materialize an isolated transforming branch from a fulfilled artifact. */
  materializeBranch(artifact: PristineArtifact): ContentBranch
  /** Read the opaque pristine tree (for static projections — no branch VFile). */
  readPristineTree(artifact: PristineArtifact): OpaquePristineTree
}

/** Remove html comments (`<!-- ... -->`) from the mdast tree. */
const remarkRemoveComments = () => (tree: Mdast) => {
  visit(tree, 'html', (node, index, parent) => {
    if (parent == null || index == null) return
    if (node.value.match(/<!--([\s\S]*?)-->/g)) {
      parent.children.splice(index, 1)
      return ['skip', index]
    }
  })
}

/** Remove `/* ... *​/` comments from mdx flow expressions. */
const remarkRemoveMdxComments = () => (tree: Mdast) => {
  visit(tree, ['mdxFlowExpression'], (node, index, parent) => {
    if (parent == null || index == null) return
    if ((node as { value?: string }).value?.match(/\/\*([\s\S]*?)\*\//g)) {
      parent.children.splice(index, 1)
      return ['skip', index]
    }
  })
}

/** Build the remark plugin list for the pristine parse (syntax extensions participate; returned transformers do NOT run here). */
const buildParseRemarkPlugins = (gfm: boolean, removeComments: boolean, dialect: 'markdown' | 'mdx', extra: PluggableList): PluggableList => {
  const list: PluggableList = []
  if (gfm) list.push(remarkGfm)
  if (removeComments) list.push(dialect === 'mdx' ? remarkRemoveMdxComments : remarkRemoveComments)
  list.push(...extra)
  return list
}

/** Extract the standard reportable fields from a VFileMessage without invoking getters. */
const extractMessageFields = (m: VFileMessage): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  const mRecord = m as unknown as Record<string, unknown>
  for (const f of MESSAGE_FIELDS) {
    const desc = Object.getOwnPropertyDescriptor(m, f)
    if (desc !== undefined && desc.enumerable && desc.get === undefined) {
      out[f] = desc.value
    } else {
      const v = mRecord[f]
      if (v !== undefined) out[f] = v
    }
  }
  for (const key of Object.keys(m)) {
    if (!(key in out)) {
      const desc = Object.getOwnPropertyDescriptor(m, key)
      if (desc !== undefined && desc.enumerable && desc.get === undefined) out[key] = desc.value
    }
  }
  return out
}

/** Snapshot the parse VFile into a seed, extracting the supported state. */
const snapshotParseVFile = (file: VFileType): VFileSeed => {
  const rawMessages = file.messages.map(m => extractMessageFields(m))
  return snapshotSeed({ cwd: file.cwd, history: file.history, data: file.data, messages: rawMessages })
}

/** Materialize a fresh branch VFile from a seed + the original selected text. */
const materializeBranchFile = (seed: VFileSeed, text: string): VFileType => {
  const file = new VFile({ value: text, cwd: seed.cwd, history: [...seed.history] })
  file.data = cloneSupportedData(seed.data) as Record<string, unknown>
  file.messages = seed.messages.map(m => {
    const msg = new VFileMessage('')
    if (typeof m.reason === 'string') msg.reason = m.reason
    if (typeof m.fatal === 'boolean') msg.fatal = m.fatal
    if (typeof m.file === 'string') msg.file = m.file
    if (typeof m.name === 'string') msg.name = m.name
    if (typeof m.line === 'number') msg.line = m.line
    if (typeof m.column === 'number') msg.column = m.column
    if (m.place !== undefined) msg.place = m.place as never
    if (typeof m.source === 'string') msg.source = m.source
    if (typeof m.ruleId === 'string') msg.ruleId = m.ruleId
    if (m.actual !== undefined) msg.actual = m.actual as never
    if (m.expected !== undefined) msg.expected = m.expected as never
    if (typeof m.note === 'string') msg.note = m.note
    if (typeof m.url === 'string') msg.url = m.url
    if (typeof m.stack === 'string') msg.stack = m.stack
    if (m.cause !== undefined) (msg as { cause?: unknown }).cause = m.cause
    return msg
  })
  return file
}

/** Build the Markdown dialect adapter. */
export const createMarkdownAdapter = (): ContentDialectAdapter => ({
  dialect: 'markdown',
  async parse(input: ParseInput): Promise<PristineArtifact> {
    const remarkPlugins = buildParseRemarkPlugins(input.gfm, input.removeComments, 'markdown', input.remarkPlugins)
    const file = new VFile({ value: input.text, path: input.path, cwd: input.cwd })
    const processor = unified().use(remarkParse).use(remarkPlugins)
    const tree = processor.parse(file) as Mdast
    const fileSeed = snapshotParseVFile(file)
    return { tree, fileSeed, text: input.text }
  },
  materializeBranch(artifact: PristineArtifact): ContentBranch {
    const tree: Mdast = structuredClone(artifact.tree)
    const file = materializeBranchFile(artifact.fileSeed, artifact.text)
    return { tree, file }
  },
  readPristineTree(artifact: PristineArtifact): OpaquePristineTree {
    return artifact.tree
  }
})

/** Build the MDX dialect adapter. */
export const createMdxAdapter = (): ContentDialectAdapter => ({
  dialect: 'mdx',
  async parse(input: ParseInput): Promise<PristineArtifact> {
    const remarkPlugins = buildParseRemarkPlugins(input.gfm, input.removeComments, 'mdx', input.remarkPlugins)
    const file = new VFile({ value: input.text, path: input.path, cwd: input.cwd })
    // Use @mdx-js/mdx's processor.parse for the pristine mdast tree so MDX
    // syntax extensions (Jsx, expressions) participate. Returned transformers
    // do NOT run during the pristine parse — processor.parse only runs the
    // parser (syntax extensions). The pristine mdast carries MDX node types
    // (mdxFlowExpression, mdxJsxFlowTag, ...); static projections traverse it
    // transparently. MDX compilation (run + stringify) runs in the
    // transforming branch.
    const { createProcessor } = await import('@mdx-js/mdx')
    const processor = createProcessor({ development: false, outputFormat: 'function-body', remarkPlugins })
    const tree = processor.parse(file) as unknown as Mdast
    const fileSeed = snapshotParseVFile(file)
    return { tree, fileSeed, text: input.text }
  },
  materializeBranch(artifact: PristineArtifact): ContentBranch {
    const tree: Mdast = structuredClone(artifact.tree)
    const file = materializeBranchFile(artifact.fileSeed, artifact.text)
    return { tree, file }
  },
  readPristineTree(artifact: PristineArtifact): OpaquePristineTree {
    return artifact.tree
  }
})

/** The dialect adapter pair for the pipeline composition root. */
export interface DialectAdapterPair {
  readonly markdown: ContentDialectAdapter
  readonly mdx: ContentDialectAdapter
}
