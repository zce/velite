import type { BuilderDeps } from '../../src/core/builder'
import type { ImageProcessor } from '../../src/runtime/image'
import type { Watcher } from '../../src/runtime/watcher'

export type TestRuntime = Pick<BuilderDeps, 'fs' | 'modules' | 'contextStorage' | 'logger' | 'image' | 'watch'>

export const noopImageProcessor: ImageProcessor = {
  probe: async () => ({ width: 0, height: 0, format: '' }),
  blurDataURL: async () => ''
}

export const noopWatch = (): Watcher => ({
  subscribe: () => () => {}
})
