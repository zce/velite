import json from './json'
import matter from './matter'
import yaml from './yaml'

export { defineLoader } from './types'

export const loaders = [json, yaml, matter]
