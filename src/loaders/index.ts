import { getConfig } from '../config'
import json from './json'
import markdown from './markdown'
import yaml from './yaml'

import type { Loader } from '../types'

const builtInloaders = [json, yaml, markdown]

export const addLoader = (loader: Loader): void => {
  const index = builtInloaders.findIndex(item => item.name === loader.name)
  if (index === -1) {
    builtInloaders.unshift(loader)
  } else {
    builtInloaders[index] = loader
  }
}

export const removeLoader = (name: string): void => {
  const index = builtInloaders.findIndex(loader => loader.name === name)
  index !== -1 && builtInloaders.splice(index, 1)
}

export const resolveLoader = (filename: string): Loader | undefined => {
  const { loaders } = getConfig()
  return [...loaders, ...builtInloaders].find(loader => loader.test.test(filename))
}
