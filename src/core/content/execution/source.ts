import type { Metadata } from '../results'

interface TextNode {
  type: string
  value?: unknown
  children?: readonly TextNode[]
}

/** Finite source facts, captured before the owned tree can be transformed. */
export const sourceText = (tree: TextNode): string => {
  const fragments: string[] = []
  const collect = (node: TextNode): void => {
    if (node.type === 'text' || node.type === 'inlineCode') {
      if (typeof node.value === 'string') fragments.push(node.value)
      return
    }
    if (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression' || node.type === 'mdxjsEsm') return
    for (const child of node.children ?? []) collect(child)
  }
  collect(tree)
  return fragments.join(' ').replace(/\s+/gu, ' ').trim()
}

export const sourceExcerpt = (text: string, length: number): string => {
  const points = Array.from(text)
  return points.length <= length ? text : points.slice(0, length).join('').trimEnd() + '…'
}

const CJK_RANGES: readonly (readonly [number, number])[] = [
  [0x2e80, 0x2e9a],
  [0x2e9b, 0x2ef4],
  [0x2f00, 0x2fd6],
  [0x3005, 0x3006],
  [0x3007, 0x3008],
  [0x3021, 0x302a],
  [0x3038, 0x303c],
  [0x3400, 0x4db6],
  [0x4e00, 0x9feb],
  [0xf900, 0xfa6e],
  [0xfa70, 0xfada],
  [0x20000, 0x2a6d7],
  [0x2a700, 0x2b735],
  [0x2b740, 0x2b81e],
  [0x2b820, 0x2cea2],
  [0x2ceb0, 0x2ebe1],
  [0x2f800, 0x2fa1e],
  [0x3041, 0x3097],
  [0x309d, 0x30a0],
  [0x1b001, 0x1b11f],
  [0x1f200, 0x1f201],
  [0x30a1, 0x30fb],
  [0x30fd, 0x3100],
  [0x31f0, 0x3200],
  [0x32d0, 0x32ff],
  [0x3300, 0x3358],
  [0xff66, 0xff70],
  [0xff71, 0xff9e],
  [0x1b000, 0x1b001]
]

export const sourceMetadata = (text: string): Metadata => {
  const latin = new RegExp(
    "(?:[\\p{Letter}&&\\p{Script_Extensions=Latin}]\\p{Mark}*)+(?:['’](?:[\\p{Letter}&&\\p{Script_Extensions=Latin}]\\p{Mark}*)+)*",
    'gv'
  )
  let cjk = 0
  for (const point of text) {
    const code = point.codePointAt(0)!
    if (CJK_RANGES.some(([start, end]) => code >= start && code < end)) cjk++
  }
  const wordCount = Array.from(text.matchAll(latin)).length + cjk * 0.56
  return { readingTime: Math.max(1, Math.round(wordCount / 265)), wordCount }
}
