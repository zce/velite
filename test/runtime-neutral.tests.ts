import { ok } from 'node:assert'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { test } from 'node:test'

const CORE_DIR = new URL('../src/core/', import.meta.url).pathname

// Imports the core is NEVER allowed to take: runtime-specific or native.
// Allowed core deps: picomatch, zod, unified, @mdx-js/mdx, yaml (pure data/string).
const FORBIDDEN = [/^node:/, /^sharp$/, /^chokidar$/, /^tinyglobby$/, /^jiti$/]

// Spec-accepted exception: `node:async_hooks` powers the AsyncLocalStorage that
// threads the schema context through zod transforms (design §4). It is the ONLY
// node builtin the core touches, available in Node/Deno/Bun, and confined to
// schema/context.ts. Listed explicitly so the guard stays honest rather than
// being bypassed with a bare `'async_hooks'` import.
const ALLOWED_NODE = new Set(['node:async_hooks'])

const collectTsFiles = async (dir: string): Promise<string[]> => {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await collectTsFiles(full)))
    else if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

// Matches `import ... from 'spec'` and bare `import 'spec'` (static imports only).
const IMPORT_RE = /^\s*import(?:\s+[^'"]+)?\s*(?:from\s*)?['"]([^'"]+)['"]/gm

test('runtime-neutral: core imports no node: builtins or native/host-only deps', async () => {
  const files = await collectTsFiles(CORE_DIR)
  ok(files.length > 0, 'core should contain runtime-agnostic ts files')

  const violations: string[] = []
  for (const file of files) {
    const src = await readFile(file, 'utf8')
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1]!
      if (ALLOWED_NODE.has(spec)) continue
      if (FORBIDDEN.some(re => re.test(spec))) {
        violations.push(`${relative(process.cwd(), file)}: ${spec}`)
      }
    }
  }
  ok(violations.length === 0, `core has forbidden imports:\n${violations.join('\n')}`)
})
