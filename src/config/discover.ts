import { access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { name as pkgName } from '../../package.json'
import { fail } from '../core/errors'

const CONFIG_NAMES = [
  `${pkgName}.config.js`,
  `${pkgName}.config.ts`,
  `${pkgName}.config.mjs`,
  `${pkgName}.config.mts`,
  `${pkgName}.config.cjs`,
  `${pkgName}.config.cts`
] as const

/**
 * Search up to `depth` parent directories for the first matching config file.
 *
 * @returns absolute path to the config file, or `undefined` if not found.
 */
const findConfig = async (cwd: string = process.cwd(), depth = 3): Promise<string | undefined> => {
  for (const name of CONFIG_NAMES) {
    try {
      const path = resolve(cwd, name)
      await access(path)
      return path
    } catch {
      continue
    }
  }
  if (depth > 0 && !(cwd === '/' || cwd.endsWith(':\\'))) {
    return findConfig(dirname(cwd), depth - 1)
  }
  return undefined
}

/** Resolve a config path — either discover automatically or validate the user-supplied path. */
export const resolveConfigPath = async (path: string | undefined, cwd: string = process.cwd()): Promise<string> => {
  const resolved = path != null ? resolve(cwd, path) : await findConfig(cwd)
  if (resolved == null) {
    fail('config', { message: `config file not found, create '${pkgName}.config.ts' in your project root`, context: { searched: cwd } })
  }
  if (!/\.(js|mjs|cjs|ts|mts|cts)$/.test(resolved)) {
    const ext = resolved.split('.').pop()
    fail('config', { message: `not supported config file with '${ext}' extension`, context: { ext, path: resolved } })
  }
  return resolved
}
