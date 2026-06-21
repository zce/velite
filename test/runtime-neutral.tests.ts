// test/runtime-neutral.tests.ts
import { ok } from 'node:assert'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { test } from 'node:test'

const CORE_DIR = new URL('../src/core/', import.meta.url).pathname

// The M1/M2a runtime-agnostic core lives in these subdirectories.
// Legacy top-level files (ids.ts, project.ts, cache.ts, ...) are pre-refactor
// code kept as reference, scheduled for deletion in M2 (see specs.md §0.3 /
// "M2 跑通后删除旧 src/"). They are not subject to the runtime-agnostic rule
// and are excluded from the scan. When M2 migrates the remaining concerns into
// new subdirectories, extend this list.
const RUNTIME_AGNOSTIC_DIRS = ['engine', 'util', 'host', 'loader', 'schema', 'output']

// New runtime-agnostic top-level core files (M2a). Listed explicitly because the
// legacy top-level core files in the same directory are not yet migrated.
const RUNTIME_AGNOSTIC_FILES = ['model.ts', 'diagnostic.ts', 'config.ts']

// Imports the core is NEVER allowed to take: runtime-specific or native.
// Allowed core deps: picomatch, zod, unified, @mdx-js/mdx, yaml (pure data/string).
const FORBIDDEN = [
  /^node:/, // any node: builtin
  /^sharp$/,
  /^chokidar$/,
  /^tinyglobby$/,
  /^jiti$/
]

const collectTsFiles = async (dir: string): Promise<string[]> => {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await collectTsFiles(full)))
    else if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

// Matches `import ... from 'spec'` and `import 'spec'` (static imports only).
const IMPORT_RE = /^\s*import(?:\s+[^'"]+)?\s*(?:from\s*)?['"]([^'"]+)['"]/gm

test('runtime-neutral: core imports no node: builtins or native/host-only deps', async () => {
  const files: string[] = []
  for (const dir of RUNTIME_AGNOSTIC_DIRS) {
    files.push(...(await collectTsFiles(join(CORE_DIR, dir))))
  }
  for (const name of RUNTIME_AGNOSTIC_FILES) {
    files.push(join(CORE_DIR, name))
  }
  ok(files.length > 0, 'core runtime-agnostic dirs should contain ts files')

  const violations: string[] = []
  for (const file of files) {
    const src = await readFile(file, 'utf8')
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1]!
      if (FORBIDDEN.some(re => re.test(spec))) {
        violations.push(`${relative(process.cwd(), file)}: ${spec}`)
      }
    }
  }
  ok(violations.length === 0, `core has forbidden imports:\n${violations.join('\n')}`)
})
