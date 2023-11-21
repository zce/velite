import { words } from 'lodash-es'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toString } from 'mdast-util-to-string'
import { z } from 'zod'

// Unicode ranges for Han (Chinese) and Hiragana/Katakana (Japanese) characters
const cjRanges = [
  [11904, 11930], // Han
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
  [12353, 12439], // Hiragana
  [12445, 12448],
  [110593, 110879],
  [127488, 127489],
  [12449, 12539], // Katakana
  [12541, 12544],
  [12784, 12800],
  [13008, 13055],
  [13056, 13144],
  [65382, 65392],
  [65393, 65438],
  [110592, 110593]
]

const isCjChar = (char: string) => {
  const charCode = char.codePointAt(0) ?? 0
  return cjRanges.some(([from, to]) => charCode >= from && charCode < to)
}

const getMetadata = (text: string): Metadata => {
  // https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby-transformer-remark/src/utils/time-to-read.js
  const avgWPM = 265

  const latinChars = []
  const cjChars = []

  for (const char of text) {
    if (isCjChar(char)) {
      cjChars.push(char)
    } else {
      latinChars.push(char)
    }
  }

  // Multiply non-latin character string length by 0.56, because
  // on average one word consists of 2 characters in both Chinese and Japanese
  const wordCount = words(latinChars.join(``)).length + cjChars.length * 0.56

  const time = Math.round(wordCount / avgWPM)

  return {
    readingTime: time === 0 ? 1 : time,
    wordCount: wordCount
  }
}

/**
 * Document metadata.
 */
export interface Metadata {
  /**
   * Reading time in minutes.
   */
  readingTime: number
  /**
   * Word count.
   */
  wordCount: number
}

export const metadata = () =>
  z.string().transform(async (value, ctx) => {
    const mdast = fromMarkdown(value)
    const content = toString(mdast)
    return getMetadata(content)
  })
