// Metadata projection: reading time + word count.
//
// The top-level `s.metadata()` form is removed; `.metadata()` is a method on
// the dialect root. The `Metadata` type and the `computeMetadata` helper are
// shared by the Markdown and MDX roots.

import { extractText } from '../content/reference'

import type { Root as Mdast } from 'mdast'

/** Document metadata: reading time in minutes and word count. */
export interface Metadata {
  /** Reading time in minutes. */
  readingTime: number
  /** Word count. */
  wordCount: number
}

// Unicode ranges for Han (Chinese) and Hiragana/Katakana (Japanese) characters.
const cjRanges: ReadonlyArray<readonly [number, number]> = [
  [11904, 11930],
  [11931, 12020],
  [12032, 12246],
  [12293, 12294],
  [12295, 12296],
  [12321, 12330],
  [12344, 12348],
  [13312, 19894],
  [19968, 40939],
  [63744, 64110],
  [64112, 64218],
  [131072, 173783],
  [173824, 177973],
  [177984, 178206],
  [178208, 183970],
  [183984, 191457],
  [194560, 195102],
  [12353, 12439],
  [12445, 12448],
  [110593, 110879],
  [127488, 127489],
  [12449, 12539],
  [12541, 12544],
  [12784, 12800],
  [13008, 13055],
  [13056, 13144],
  [65382, 65392],
  [65393, 65438],
  [110592, 110593]
]

const isCjChar = (char: string): boolean => {
  const charCode = char.codePointAt(0) ?? 0
  return cjRanges.some(([from, to]) => charCode >= from && charCode < to)
}

const wordLength = (str: string): number => {
  const reWord = /['']?([a-zA-Z]+(?:['']?[a-zA-Z]+)*)/g
  const words = str.match(reWord) || []
  return words.length
}

/**
 * Compute reading-time metadata from an mdast tree.
 *
 * Transitional: the final v-flag Latin regex, frozen CJK table, and weighting
 * arithmetic will replace this helper in a later stage.
 */
export const computeMetadata = (tree: Mdast): Metadata => {
  const plain = extractText(tree, 10_000)
  const avgWPM = 265
  const latinChars: string[] = []
  const cjChars: string[] = []
  for (const char of plain) {
    if (isCjChar(char)) cjChars.push(char)
    else latinChars.push(char)
  }
  const wordCount = wordLength(latinChars.join('')) + cjChars.length * 0.56
  const time = Math.round(wordCount / avgWPM)
  return { readingTime: time === 0 ? 1 : time, wordCount }
}
