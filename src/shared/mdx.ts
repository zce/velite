// // https://github.com/Modwatch/Frontend/blob/02fa6aca8341cc4eb4307272b66364c33f520429/generatepostmeta.ts#L68

// import { dirname, extname, isAbsolute, join, resolve } from 'node:path'
// import { StringDecoder } from 'node:string_decoder'
// import { NodeResolvePlugin } from '@esbuild-plugins/node-resolve'
// import { globalExternals } from '@fal-works/esbuild-plugin-global-externals'
// import mdxPlugin from '@mdx-js/esbuild'
// import { build } from 'esbuild'
// import { VFile } from 'vfile'
// import z from 'zod'

// import type { ModuleInfo } from '@fal-works/esbuild-plugin-global-externals'
// import type { BuildOptions, Loader, Plugin } from 'esbuild'
// import type { PluggableList } from 'unified'

// interface MdxBody {
//   // raw: string
//   plain: string
//   excerpt: string
//   code: string
// }
// interface MdxOptions {
//   remarkPlugins?: PluggableList
//   rehypePlugins?: PluggableList
// }
// export const mdx = (options: MdxOptions = {}) =>
//   z.string().transform(async (value, ctx): Promise<MdxBody> => {
//     const path = ctx.path[0] as string
//     const bundled = await build(await esbuildOptions(file, globals))
//     const decoder = new StringDecoder('utf8')

//     if (bundled.outputFiles === undefined || bundled.outputFiles.length === 0) {
//       throw new Error('Esbuild bundling error')
//     }

//     const code = decoder.write(Buffer.from(bundled.outputFiles[0].contents))

//     return {
//       code: `${code};return Component`
//     }

//     return {
//       // raw: value,
//       plain: value as string,
//       excerpt: value as string,
//       code: code || ''
//     }
//   })

// /**
//  * Mostly derived from MDX Bundler, but strips out a lot of the stuff we don't need as
//  * well as fix some incompatabilities with esbuild resolution with pnpm and esm plugins.
//  */

// export interface FrontMatter {
//   title: string
//   section: string
//   description?: string
// }
// export interface SerialiseOutput {
//   code: string
//   frontmatter: FrontMatter
// }

// export type Globals = Record<string, string>

// const esbuildOptions = async (source: VFile, globals: Globals): Promise<BuildOptions> => {
//   const absoluteFiles: Record<string, string> = {}

//   const entryPath = source.path ? (isAbsolute(source.path) ? source.path : join(source.cwd, source.path)) : join(source.cwd, `./_mdx_bundler_entry_point-${Math.random()}.mdx`)
//   absoluteFiles[entryPath] = String(source.value)

//   // https://github.com/kentcdodds/mdx-bundler/pull/206
//   const define: BuildOptions['define'] = {}
//   if (process.env.NODE_ENV !== undefined) {
//     define['process.env.NODE_ENV'] = JSON.stringify(process.env.NODE_ENV)
//   }

//   // Import any imported components into esbuild resolver
//   const inMemoryPlugin: Plugin = {
//     name: 'inMemory',
//     setup(build) {
//       build.onResolve({ filter: /.*/ }, ({ path: filePath, importer }) => {
//         if (filePath === entryPath) {
//           return {
//             path: filePath,
//             pluginData: { inMemory: true, contents: absoluteFiles[filePath] }
//           }
//         }

//         const modulePath = resolve(dirname(importer), filePath)

//         if (modulePath in absoluteFiles) {
//           return {
//             path: modulePath,
//             pluginData: {
//               inMemory: true,
//               contents: absoluteFiles[modulePath]
//             }
//           }
//         }

//         for (const ext of ['.js', '.ts', '.jsx', '.tsx', '.json', '.mdx', '.css']) {
//           const fullModulePath = `${modulePath}${ext}`
//           if (fullModulePath in absoluteFiles) {
//             return {
//               path: fullModulePath,
//               pluginData: {
//                 inMemory: true,
//                 contents: absoluteFiles[fullModulePath]
//               }
//             }
//           }
//         }

//         // Return an empty object so that esbuild will handle resolving the file itself.
//         return {}
//       })

//       build.onLoad({ filter: /.*/ }, async ({ path: filePath, pluginData }) => {
//         if (pluginData === undefined || !pluginData.inMemory) {
//           // Return an empty object so that esbuild will load & parse the file contents itself.
//           return
//         }

//         // the || .js allows people to exclude a file extension
//         const fileType = (extname(filePath) || '.jsx').slice(1)
//         const contents = absoluteFiles[filePath]

//         if (fileType === 'mdx') return

//         const loader: Loader = build.initialOptions.loader?.[`.${fileType}`] ? build.initialOptions.loader[`.${fileType}`] : (fileType as Loader)

//         return {
//           contents,
//           loader
//         }
//       })
//     }
//   }

//   // This helps reduce bundles from having duplicated packages
//   const newGlobals: Record<string, ModuleInfo> = {}
//   for (const [key, value] of Object.entries(globals)) {
//     newGlobals[key] = {
//       varName: value,
//       type: 'cjs'
//     }
//   }

//   return {
//     entryPoints: [entryPath],
//     write: false,
//     define,
//     plugins: [
//       globalExternals(newGlobals),
//       NodeResolvePlugin({
//         extensions: ['.js', '.jsx', '.ts', '.tsx']
//       }),
//       inMemoryPlugin,
//       mdxPlugin({
//         remarkPlugins: [],
//         rehypePlugins: []
//       })
//     ],
//     bundle: true,
//     format: 'iife',
//     globalName: 'Component',
//     minify: process.env.NODE_ENV === 'production'
//   }
// }
