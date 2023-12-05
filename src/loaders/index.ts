import { context } from '../context'
import json from './json'
import matter from './matter'
import yaml from './yaml'

import type { Loader } from '../config'

const builtinLoaders = [json, yaml, matter]

/**
 * resolve loader by filename
 * @param filename load file path
 * @returns loader
 */
export const resolveLoader = (filename: string): Loader | undefined => {
  const { loaders = [] } = context
  return [...loaders, ...builtinLoaders].find(loader => loader.test.test(filename))
}

// import { Loader } from '../types'
// import json from './json'
// import matter from './matter'
// import yaml from './yaml'

// export const loaders = [json, yaml, matter]

// // export const addLoader = (loader: Loader): void => {
// //   const index = loaders.findIndex(item => item.name === loader.name)
// //   if (index === -1) {
// //     loaders.unshift(loader)
// //   } else {
// //     loaders[index] = loader
// //   }
// // }

// // export const removeLoader = (name: string): void => {
// //   const index = loaders.findIndex(loader => loader.name === name)
// //   index !== -1 && loaders.splice(index, 1)
// // }

// // /**
// //  * resolve loader by filename
// //  * @param filename load file path
// //  * @returns loader
// //  */
// // export const resolveLoader = (filename: string): Loader | undefined => {
// //   return loaders.find(loader => loader.test.test(filename))
// // }
