import { VFile } from 'vfile'

import { fail } from '../../diagnostic'
import { sourceText } from './source'

import type { OwnedContent } from './types'

interface ContentTree {
  type: string
  children?: ContentTree[]
  value?: unknown
}

/** A local typing correction at the dependency's parse/run/stringify seam. */
export interface ContentProcessor {
  freeze(): unknown
  parse(file: VFile): ContentTree
  run(tree: ContentTree, file: VFile, done: (error?: Error | null, tree?: ContentTree, file?: VFile) => void): unknown
  stringify(tree: ContentTree, file: VFile): unknown
}

export interface OwnedProcessorDeps {
  configure(): ContentProcessor | Promise<ContentProcessor>
  path: string
  cwd: string
  text: string
}

// Unified's compiler-value guard is structural, including byte views from
// another realm. Keep its ordinary value/result behavior at this adapter seam.
const isFileValue = (value: unknown): value is string | Uint8Array =>
  typeof value === 'string' || Boolean(value && typeof value === 'object' && 'byteLength' in value && 'byteOffset' in value)

export const createOwnedProcessor = ({ configure, path, cwd, text }: OwnedProcessorDeps): Omit<OwnedContent, 'navigation'> => {
  let file: VFile | undefined = new VFile({ path, cwd, value: text })
  let tree: ContentTree | undefined
  let processor: ContentProcessor | undefined
  let source = ''
  let messages: { reason: string; fatal?: boolean | null }[] = []
  let closed = false
  const active = (): void => {
    if (closed) fail('internal', 'Owned content processor is closed')
  }
  // `transform`/`emit` need the state `parse` installs and `release()` clears
  // (emit releases, so a second emit lands here too). Both are module-internal
  // sequencing bugs — surface them as clean internal errors instead of raw
  // TypeErrors on undefined.
  const ready = (): void => {
    active()
    if (processor === undefined || tree === undefined || file === undefined) fail('internal', 'Owned content processor has no parsed content')
  }
  const release = (): void => {
    if (file) messages = file.messages.map(message => ({ reason: message.reason, fatal: message.fatal }))
    processor = undefined
    tree = undefined
    file = undefined
  }
  return {
    async parse() {
      active()
      const configured = await configure()
      active()
      processor = configured
      configured.freeze()
      tree = configured.parse(file!)
      source = sourceText(tree)
    },
    transform() {
      ready()
      return new Promise<void>((resolve, reject) => {
        processor!.run(tree!, file!, (error, nextTree, nextFile) => {
          if (error) {
            reject(error)
            return
          }
          try {
            active()
            if (!nextTree || !nextFile) fail('internal', 'Processor run did not return a tree and file')
            tree = nextTree
            file = nextFile
            resolve()
          } catch (fault) {
            reject(fault)
          }
        })
      })
    },
    emit() {
      ready()
      const result = processor!.stringify(tree!, file!)
      if (isFileValue(result)) file!.value = result
      else file!.result = result
      const output = String(file)
      release()
      return output
    },
    sourceText: () => source,
    messages: () => file?.messages ?? messages,
    close() {
      if (closed) return
      closed = true
      release()
      source = ''
    }
  }
}
