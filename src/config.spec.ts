import { beforeAll, expect, test } from 'vitest'
import { resolveConfig } from './config'

beforeAll(() => {
  process.chdir('fixtures/configs')
})

test('unit:config:resolveConfig:default', async () => {
  const config = await resolveConfig()
  expect(config?.root).toBe('test')
  expect(config?.output.data).toBe('data')
  expect(config?.output.static).toBe('static')
  expect(config?.output.public).toBe('/static')
})

test('unit:config:resolveConfig:commonjs', async () => {
  const config = await resolveConfig('commonjs.config.js')
  expect(config?.root).toBe('test')
  expect(config?.output.data).toBe('data')
  expect(config?.output.static).toBe('static')
  expect(config?.output.public).toBe('/static')
})

test('unit:config:resolveConfig:specific', async () => {
  const config = await resolveConfig('named.config.json')
  expect(config).toBeDefined()
  await expect(() => resolveConfig('not-exist')).rejects.toThrow(/not-exist/)
})

test('unit:config:resolveConfig:validate', async () => {
  await expect(() => resolveConfig('invalid1.config')).rejects.toThrow('config must be an object')
  await expect(() => resolveConfig('invalid2.config')).rejects.toThrow('config.output must be an object')
  await expect(() => resolveConfig('invalid3.config')).rejects.toThrow('config.schemas must be an object')
  await expect(() => resolveConfig('invalid4.config')).rejects.toThrow('config.schemas.posts must be an object')
  await expect(() => resolveConfig('invalid5.config')).rejects.toThrow('config.schemas.posts.name must be a non-empty string')
  await expect(() => resolveConfig('invalid6.config')).rejects.toThrow('config.schemas.posts.pattern must be a non-empty string')
})
