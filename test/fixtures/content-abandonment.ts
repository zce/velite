import { rejects } from 'node:assert/strict'

import { s } from '../../src/core'
import { createBuilder } from '../../src/core/builder'
import { VeliteError } from '../../src/core/diagnostic'
import { content } from '../../src/core/schema/content'
import { silentLogger } from '../../src/runtime/adapters/node'
import { MemoryFileSystem } from '../helpers/memory-fs'
import { noopImageProcessor, noopWatch, testContentExecutionsFactory, testSchemaRunner } from '../helpers/runtime'

const fs = new MemoryFileSystem()
fs.put('/proj/content/post.md', '# Source')
const failure = new VeliteError('internal', { message: 'synchronous sibling fault' })
const pending: Promise<unknown>[] = []
const runner = testSchemaRunner()
const selected = content.markdown().html()
const instance = createBuilder({
  cwd: '/proj',
  configPath: '/proj/velite.config.ts',
  fs,
  modules: {
    load: async () => ({
      exports: {
        collections: {
          posts: {
            pattern: '*.md',
            schema: s.object({
              ...(process.argv[2] === 'nested' ? { nested: s.object({ pending: selected }).prefault({}) } : { pending: selected }),
              fatal: s
                .string()
                .optional()
                .transform(() => {
                  throw failure
                })
            })
          }
        }
      },
      dependencies: []
    })
  },
  schemaRunner: {
    run(input, operation) {
      return runner.run(
        {
          ...input,
          contentOperation(request) {
            const value = input.contentOperation(request)
            pending.push(value)
            void value.catch(() => {})
            return value
          }
        },
        operation
      )
    }
  },
  contentExecutionsFactory: testContentExecutionsFactory(),
  image: noopImageProcessor,
  logger: silentLogger,
  watch: noopWatch
})
await rejects(instance.build(), error => error === failure)
await Promise.allSettled(pending)
await instance.dispose()
