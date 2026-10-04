/** Recognize empty/comment-only expressions without evaluating any MDX code. */
export const isMdxCommentExpression = (node: { type?: string; value?: unknown }): boolean =>
  (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression') &&
  typeof node.value === 'string' &&
  /^(?:\s|\/\*(?:(?!\*\/)[\s\S])*\*\/|\/\/[^\r\n]*)*$/.test(node.value)
