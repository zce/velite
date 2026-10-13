// Minimal structural view of a unified/unist tree node for generic walks.

/**
 * Recursively drop every child matching `drop` from a unified tree, in place.
 * The predicate sees direct children; recursion handles the rest. Nodes whose
 * `children` is absent are left untouched.
 */
export const removeChildrenWhere = (node: { children?: unknown[] }, drop: (child: unknown) => boolean): void => {
  if (node.children === undefined) return
  node.children = node.children.filter(child => !drop(child))
  for (const child of node.children) removeChildrenWhere(child as { children?: unknown[] }, drop)
}
