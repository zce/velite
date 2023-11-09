import { resolve } from 'node:path'
import { name } from '../package.json'
import type { Computeds, Config, Fields, Schema } from './types'

// for user config type inference
export const defineConfig = (config: Config): Config => config
export const defineSchema = (schema: Schema): Schema => schema
export const defineNestedType = (fields: Fields): Fields => fields
export const defineComputeds = (computeds: Computeds): Computeds => computeds

/**
 * validate user config
 * @param config any config
 * @returns validated config
 */
const validateConfig = (config: any): Config => {
  if (typeof config !== 'object') {
    throw new Error('config must be an object')
  }
  if (typeof config.output !== 'object') {
    throw new Error('config.output must be an object')
  }
  if (typeof config.schemas !== 'object') {
    throw new Error('config.schemas must be an object')
  }
  Object.entries<any>(config.schemas).forEach(([name, schema]) => {
    if (typeof schema !== 'object') {
      throw new Error(`config.schemas.${name} must be an object`)
    }
    if (typeof schema.name !== 'string' || schema.name === '') {
      throw new Error(`config.schemas.${name}.name must be a non-empty string`)
    }
    if (typeof schema.pattern !== 'string' || schema.pattern === '') {
      throw new Error(`config.schemas.${name}.pattern must be a non-empty string`)
    }
    if (typeof schema.type !== 'string' || schema.type === '') {
      throw new Error(`config.schemas.${name}.type must be a non-empty string`)
    }
    if (typeof schema.fields !== 'object') {
      throw new Error(`config.schemas.${name}.fields must be an object`)
    }
    if (schema.computeds != null && typeof schema.computeds !== 'object') {
      throw new Error(`config.schemas.${name}.computeds must be an object`)
    }
  })
  if (config.parsers != null && typeof config.parsers !== 'object') {
    throw new Error('config.parsers must be an object')
  }
  return config
}

/**
 * resolve user config
 * @param filename config file name
 * @returns user config
 */
export const resolveConfig = async (filename?: string) => {
  filename = filename ?? name + '.config'
  try {
    const configPath = resolve(filename)
    const { default: config } = await import(configPath)
    return validateConfig(config)
  } catch (err: any) {
    if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err
    throw new Error(filename + ' not found in current directory')
  }
}
