// @ts-check
import { builtinModules } from 'node:module'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import { defineConfig } from 'rollup'
import dts from 'rollup-plugin-dts'
import esbuild, { minify } from 'rollup-plugin-esbuild'

import pkg from './package.json' assert { type: 'json' }

const external = [...Object.keys(pkg.dependencies), ...builtinModules.flatMap(m => [m, `node:${m}`]), 'fsevents']

export default defineConfig([
  {
    input: ['src/index.ts', 'src/cli.ts'],
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: `[name].js`,
      chunkFileNames: 'velite-[hash].js'
    },
    external,
    plugins: [commonjs(), resolve({ preferBuiltins: false }), esbuild({ target: 'node18' }), json(), minify()]
  },
  {
    input: 'src/index.ts',
    output: {
      format: 'esm',
      file: 'dist/index.d.ts'
    },
    external,
    plugins: [dts({ respectExternal: true })]
  }
])
