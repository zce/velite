import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { TestContext } from 'node:test'

export const contentProject = async (t: TestContext, config: string, files: Record<string, string>) => {
  const dir = await mkdtemp(join(existsSync('/tmp/opencode') ? '/tmp/opencode' : tmpdir(), 'velite-content-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await writeFile(join(dir, 'velite.config.mjs'), config)
  for (const [path, value] of Object.entries(files)) {
    await mkdir(dirname(join(dir, 'content', path)), { recursive: true })
    await writeFile(join(dir, 'content', path), value)
  }
  const entry = fileURLToPath(new URL('../../dist/index.mjs', import.meta.url))
  const api: typeof import('../../src/index') = await import(entry)
  return {
    dir,
    api,
    build: () => api.build({ cwd: dir, layout: 'single', logLevel: 'silent' }),
    read: (path: string) => readFile(join(dir, path), 'utf8')
  }
}
