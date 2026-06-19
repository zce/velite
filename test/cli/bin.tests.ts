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

test('published runtime keeps zod external for consumer type compatibility', async () => {
  const files = await readdir('dist')
  const javascript = await Promise.all(files.filter(file => file.endsWith('.js')).map(file => readFile(`dist/${file}`, 'utf8')))
  const types = await readFile('dist/index.d.ts', 'utf8')

  ok(javascript.some(content => content.includes('from "zod"') || content.includes("from 'zod'")))
  equal(types.includes('type ZodType'), false)
  equal(types.includes('ZodType,'), false)
})
