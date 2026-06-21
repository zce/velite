/**
 * Dependency graph: the source of truth for incremental invalidation.
 *
 * The graph records every influence relationship between config, collections,
 * sources, records, assets and outputs. Incremental builds do not branch on
 * event types — they classify a change set, then let the graph derive the
 * affected node set.
 *
 * Node ids are opaque strings (callers prefix them, e.g. `source:`,
 * `record:`, `asset:`, `output:`). Edges carry a `reason` for diagnostics.
 */

import type { Collections } from '../collections'

export interface GraphEdge {
  readonly from: string
  readonly to: string
  readonly reason: string
}

export interface DependencyGraph {
  /** Add a directed edge `from -> to` with a diagnostic `reason`. */
  addEdge(from: string, to: string, reason: string): void
  /** All edges currently in the graph. */
  edges(): readonly GraphEdge[]
  /** All nodes currently in the graph. */
  nodes(): readonly string[]
  /** Direct successors of `node`. */
  successors(node: string): readonly string[]
  /** Direct predecessors of `node`. */
  predecessors(node: string): readonly string[]
  /** Remove a node and every edge that touches it. */
  removeNode(node: string): void
  /**
   * Derive the full affected set reachable forwards from `roots`.
   *
   * Returns every node reachable from any root (including the roots themselves)
   * by following edges. This is the invalidation plan: every returned node must
   * be recomputed or removed.
   */
  invalidate(roots: readonly string[]): Set<string>
  /** Remove all nodes and edges. */
  clear(): void
}

export const createDependencyGraph = (): DependencyGraph => {
  // adjacency: from -> Set<to>
  const forward = new Map<string, Set<string>>()
  const reverse = new Map<string, Set<string>>()
  const edgeReasons = new Map<string, string>()

  const edgeKey = (from: string, to: string): string => `${from}${to}`

  const ensure = (map: Map<string, Set<string>>, node: string): Set<string> => {
    let set = map.get(node)
    if (set == null) {
      set = new Set()
      map.set(node, set)
    }
    return set
  }

  return {
    addEdge(from, to, reason) {
      ensure(forward, from).add(to)
      ensure(reverse, to).add(from)
      edgeReasons.set(edgeKey(from, to), reason)
      // register both endpoints as known nodes even if degree is zero elsewhere
      ensure(forward, to)
      ensure(reverse, from)
    },

    edges() {
      const result: GraphEdge[] = []
      for (const [from, targets] of forward) {
        for (const to of targets) {
          result.push({ from, to, reason: edgeReasons.get(edgeKey(from, to)) ?? '' })
        }
      }
      return result
    },

    nodes() {
      const set = new Set<string>(forward.keys())
      for (const targets of forward.values()) for (const t of targets) set.add(t)
      return Array.from(set)
    },

    successors(node) {
      return Array.from(forward.get(node) ?? [])
    },

    predecessors(node) {
      return Array.from(reverse.get(node) ?? [])
    },

    removeNode(node) {
      const succ = forward.get(node)
      if (succ != null) {
        for (const to of succ) {
          reverse.get(to)?.delete(node)
          edgeReasons.delete(edgeKey(node, to))
        }
      }
      const pred = reverse.get(node)
      if (pred != null) {
        for (const from of pred) {
          forward.get(from)?.delete(node)
          edgeReasons.delete(edgeKey(from, node))
        }
      }
      forward.delete(node)
      reverse.delete(node)
    },

    invalidate(roots) {
      const visited = new Set<string>()
      const stack = [...roots]
      while (stack.length > 0) {
        const node = stack.pop()!
        if (visited.has(node)) continue
        visited.add(node)
        const next = forward.get(node)
        if (next != null) for (const to of next) if (!visited.has(to)) stack.push(to)
      }
      return visited
    },

    clear() {
      forward.clear()
      reverse.clear()
      edgeReasons.clear()
    }
  }
}

/**
 * Build the full set of graph edges from the current build state.
 *
 * This is called at the end of a build run to produce the candidate graph
 * that will be committed on success.
 */
export const buildGraphEdges = (
  collections: Collections,
  recordIds: ReadonlyMap<string, readonly { id: string; sourceId: string }[]>,
  assetEffects: readonly { owner: string; assetPath: string }[],
  dependencyEffects: readonly { owner: string; sourceId: string }[]
): GraphEdge[] => {
  const edges: GraphEdge[] = []
  const configNode = 'config'
  for (const key of Object.keys(collections)) {
    edges.push({ from: configNode, to: `collection:${key}`, reason: 'config-affects-collection' })
    const collectionNode = `collection:${key}`
    const records = recordIds.get(key) ?? []
    for (const record of records) {
      const sourceNode = `source:${record.sourceId}`
      const recordNode = `record:${record.id}`
      edges.push({ from: collectionNode, to: sourceNode, reason: 'collection-matches-source' })
      edges.push({ from: sourceNode, to: recordNode, reason: 'source-produces-record' })
      edges.push({ from: recordNode, to: `output:${key}/${record.id}`, reason: 'record-produces-output' })
    }
  }
  for (const asset of assetEffects) {
    edges.push({ from: `record:${asset.owner}`, to: `asset:${asset.assetPath}`, reason: 'record-references-asset' })
  }
  for (const dep of dependencyEffects) {
    edges.push({ from: `source:${dep.sourceId}`, to: `source:${dep.owner}`, reason: 'loader-depends-on-source' })
  }
  return edges
}
