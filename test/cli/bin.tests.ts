import { equal, notEqual, ok } from 'node:assert'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('npm bin points directly to the built cli with a node shebang', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'))
  equal(pkg.bin.velite, './dist/cli.js')

  const cli = await readFile('dist/cli.js', 'utf8')
  ok(cli.startsWith('#!/usr/bin/env node\n'))

  const index = await readFile('dist/index.js', 'utf8')
  notEqual(index.slice(0, 2), '#!')
})

test('published runtime bundles zod instead of importing host zod', async () => {
  const files = await readdir('dist')
  const javascript = await Promise.all(files.filter(file => file.endsWith('.js')).map(file => readFile(`dist/${file}`, 'utf8')))

  for (const content of javascript) {
    equal(content.includes('from "zod"'), false)
    equal(content.includes("from 'zod'"), false)
    equal(content.includes('import("zod")'), false)
    equal(content.includes("import('zod')"), false)
  }
})
