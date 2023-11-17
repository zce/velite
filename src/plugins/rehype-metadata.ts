import { readingTime } from 'hast-util-reading-time'

import type { Root } from 'hast'
import type { Plugin } from 'unified'

interface ReadingTimeOptions {
  age: number
}

// prettier-ignore
const metadata: Plugin<[ReadingTimeOptions], Root> = ({ age }) => (tree, file) => {
  file.data.readingTime = Math.ceil(readingTime(tree, { age }))
}

export default metadata
