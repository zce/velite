import json from './json'
import markdown from './markdown'
import yaml from './yaml'

import type { Loader } from '../types'

const loaders = [json, yaml, markdown]

export const addLoader = (loader: Loader): void => {
  loaders.unshift(loader)
}

export const removeLoader = (name: string): void => {
  const index = loaders.findIndex(loader => loader.name === name)
  index !== -1 && loaders.splice(index, 1)
}

export const resolveLoader = (filename: string): Loader | undefined => {
  return loaders.find(loader => loader.test.test(filename))
}
