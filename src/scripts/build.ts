/**
 * @file Build content data from markdown and yaml files
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import glob from 'fast-glob'
import { fromHtml } from 'hast-util-from-html'
import { raw } from 'hast-util-raw'
import { toHtml } from 'hast-util-to-html'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { frontmatterFromMarkdown, frontmatterToMarkdown } from 'mdast-util-frontmatter'
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm'
import { toHast } from 'mdast-util-to-hast'
import { toMarkdown } from 'mdast-util-to-markdown'
import { frontmatter } from 'micromark-extension-frontmatter'
import { gfm } from 'micromark-extension-gfm'
import { visit } from 'unist-util-visit'
import yaml from 'yaml'

export { z } from 'zod'

import type { Config, Entry, Fields, Parsers, Schema } from './types'
import type { Html, Image, Link } from 'mdast'

// #region utils -------------------------------------------------------------------------------------------------------

const flag = (name: string): boolean => process.argv.includes(`--${name}`)
const log = (msg: string): false | void => flag('verbose') && console.log('\x1b[2m%s\x1b[0m', msg)
const warn = (msg: string): void => console.warn('\x1b[33m%s\x1b[0m', msg)
const error = (msg: string): void => console.error('\x1b[31m%s\x1b[0m', msg) // as never || process.exit(1)
const success = (msg: string): void => console.log('\x1b[32m%s\x1b[0m', msg)
const md5 = (data: string | Buffer): string => createHash('md5').update(data).digest('hex').slice(0, 8)

const resolveConfig = async (): Promise<Config> => {
  try {
    const configPath = path.resolve('content.config.js')
    const { default: userConfig } = await import(configPath)
    return userConfig
  } catch (err: any) {
    if (err.code !== 'ERR_MODULE_NOT_FOUND') error(err.message)
    else error('content.config.js not found')
    process.exit(1)
  }
}

// #endregion

// #region globals -----------------------------------------------------------------------------------------------------

// resolve user config
const config = await resolveConfig()

// #endregion

// #region functions ---------------------------------------------------------------------------------------------------

const copiedFiles = new Set<string>()
/**
 * Copy file to public directory
 * @param from original file path
 * @param ref reference path
 * @returns public url of copied file
 */
const copyToPublic = async (from: string, ref?: string): Promise<string | undefined> => {
  if (ref == null) return
  // ignore absolute url
  if (/^(https?:\/\/|data:|mailto:|\/)/.test(ref)) return ref
  // ignore empty or markdown file
  if (['', '.md'].includes(path.extname(ref))) return ref
  try {
    const target = path.join(config.root, from, '..', ref)
    const hash = md5(await fs.readFile(target))
    const name = hash + path.extname(ref)
    if (copiedFiles.has(name)) return config.output.publicUrl + name
    copiedFiles.add(name) // not await works, but await not works, becareful if copy failed
    await fs.copyFile(target, path.join(config.output.public, name))
    log(`copied '${ref}' -> '${name}'`)
    return config.output.publicUrl + name
  } catch (err: any) {
    warn(`copied '${ref}' failed: '${err.message}'`)
    return ref
  }
}

/**
 * Prepare output directories
 */
const prepare = async () => {
  if (flag('clean')) {
    // clean output directories if `--clean` requested
    await fs.rm(config.output.data, { recursive: true, force: true })
    await fs.rm(config.output.public, { recursive: true, force: true })
    log('cleaned output directories')
  }

  // ensure output directories exist
  await fs.mkdir(config.output.data, { recursive: true })
  await fs.mkdir(config.output.public, { recursive: true })
  log('ensured output directories')
}

const parsers: Parsers = {
  yaml: async file => {
    const content = await fs.readFile(path.join(config.root, file), 'utf8')
    return yaml.parse(content)
  },
  json: async file => {
    const content = await fs.readFile(path.join(config.root, file), 'utf8')
    return JSON.parse(content)
  },
  markdown: async file => {
    const content = await fs.readFile(path.join(config.root, file), 'utf8')
    const result: Record<string, unknown> = {}
    const mdast = fromMarkdown(content.trim(), { extensions: [frontmatter(), gfm()], mdastExtensions: [frontmatterFromMarkdown(), gfmFromMarkdown()] })

    // yaml matter must be the first child
    const matter = mdast.children.shift()

    if (matter?.type === 'yaml') {
      result.data = yaml.parse(matter.value as string)
    } else {
      mdast.children.unshift(matter as any)
    }

    // remove comments
    visit(mdast, 'html', node => {
      if (node.value.startsWith('<!--')) {
        node.type = 'text' as any
        node.value = ''
      }
    })

    // extract rel links and copy to public
    const links: Record<string, Link | Image | Html> = {}
    visit(mdast, 'link', node => {
      links[node.url] = node
    })
    visit(mdast, 'image', node => {
      links[node.url] = node
    })
    visit(mdast, 'html', node => {
      visit(fromHtml(node.value), 'element', ele => {
        if (typeof ele.properties.href === 'string') {
          links[ele.properties.href] = node
        }
        if (typeof ele.properties.src === 'string') {
          links[ele.properties.src] = node
        }
      })
    })
    await Promise.all(
      Object.entries(links).map(async ([url, node]) => {
        const newUrl = await copyToPublic(file, url)
        if (newUrl == null || newUrl === url) return
        if ('url' in node) {
          // markdown link or image node
          node.url = newUrl
        }
        if ('value' in node) {
          // html node
          node.value = node.value.replaceAll(url, newUrl)
        }
      })
    )

    // generate markdown
    result.raw = toMarkdown(mdast, { extensions: [frontmatterToMarkdown(), gfmToMarkdown()] })

    // parse to html
    const hast = raw(toHast(mdast, { allowDangerousHtml: true }))
    result.html = toHtml(hast, { allowDangerousHtml: true })

    // extract excerpt
    const lines: string[] = []
    visit(hast, 'text', node => {
      if (lines.length >= 5) return false // EXIT
      lines.push(node.value)
    })
    result.excerpt = lines.join('').slice(0, 100)

    return Object.assign(result, result.data)
  },
  // custom extensions
  ...config.parsers
}

/**
 * Parse file into entries
 * @param file relative path to file
 * @param type file type
 * @returns entries (with `_file` field) from file
 */
const parseContent = async (file: string, type: Schema['type']): Promise<Entry[]> => {
  const parser = parsers[type]
  if (parser == null) {
    error(`parser for '${type}' not found`)
    return []
  }
  try {
    // muitiple entries in one file (e.g. array yaml or array json)
    // single entry in one file (e.g. markdown or single json or single yaml)
    const data = await parser(file)
    const entries = Array.isArray(data) ? data : [data]
    log(`parsed ${entries.length} entries from '${file}'`)
    return entries.map(e => ({ ...e, _file: file }))
  } catch (err: any) {
    error(`failed to parse '${file}': ${err.message}`)
    return []
  }
}

/**
 * Process entry with schema fields
 * @param entry entry to process
 * @param fields schema fields
 * @returns processed entry
 */
const processField = async (entry: Entry, fields: Fields): Promise<Entry | undefined> => {
  try {
    // process fields
    const results: [string, any][] = await Promise.all(
      Object.entries(fields).map(async ([name, field]) => {
        if (field.required && field.default == null && entry[name] == null) {
          throw new Error(`[field] ${name} is required in '${entry._file}'`)
        }
        // get field value
        const value = entry[name]
        // process field value
        if (field.type === 'string') {
          const temp = value ?? field.default
          return [name, temp && String(temp)]
        } else if (field.type === 'number') {
          const temp = value ?? field.default
          return [name, temp && Number(temp)]
        } else if (field.type === 'boolean') {
          const temp = value ?? field.default
          return [name, temp && Boolean(temp)]
        } else if (field.type === 'date') {
          const temp = (value as string | undefined) ?? field.default
          return [name, temp && new Date(temp)]
        } else if (field.type === 'file') {
          if (entry._file == null) throw new Error(`[field] missing '_file' in entry`)
          const temp = (value as string | undefined) ?? field.default
          return [name, temp && (await copyToPublic(entry._file as string, temp))]
        } else if (field.type === 'nested') {
          const temp = (value as Entry | undefined) ?? field.default
          return [name, temp && (await processField({ ...temp, _file: entry._file }, field.of))]
        } else if (field.type === 'list' && field.of === 'string') {
          const temp = (value as string[] | undefined) ?? field.default
          return [name, temp && temp.map(String)]
        } else if (field.type === 'list' && field.of === 'number') {
          const temp = (value as string[] | undefined) ?? field.default
          return [name, temp && temp.map(Number)]
        } else if (field.type === 'list' && field.of === 'boolean') {
          const temp = (value as string[] | undefined) ?? field.default
          return [name, temp && temp.map(Boolean)]
        } else if (field.type === 'list' && field.of === 'date') {
          const temp = (value as string[] | undefined) ?? field.default
          return [name, temp && temp.map(v => new Date(v))]
        } else if (field.type === 'list' && field.of === 'file') {
          const temp = (value as string[] | undefined) ?? field.default
          return [name, temp && (await Promise.all(temp.map(v => copyToPublic(entry._file as string, v))))]
        } else if (field.type === 'list' && field.of instanceof Object) {
          const temp = (value as Entry[] | undefined) ?? field.default
          return [name, temp && (await Promise.all(temp.map(v => processField({ ...v, _file: entry._file }, field.of))))]
        }
        return [name, value] // unknown field type Meaningless if `strict` is `true`
      })
    )

    // return processed entry
    return Object.fromEntries(results)
  } catch (err: any) {
    warn(err.message)
  }
}

/**
 * Load entries from files
 * @param name collection name
 * @param schema collection schema
 * @returns entries from files
 */
const load = async (name: string, schema: Schema): Promise<Entry[]> => {
  log(`loading ${name} from '${schema.pattern}'`)
  const files = await glob(schema.pattern, { cwd: config.root, onlyFiles: true, ignore: ['**/_*'] })
  log(`loaded ${name} ${files.length} files`)

  // parse original data from files
  const parsedContents = await Promise.all(files.map(file => parseContent(file, schema.type)))
  const original = parsedContents.flat()
  log(`parsed ${name} ${original.length} entries`)

  // process fields
  const result = await Promise.all(original.map(entry => processField(entry, schema.fields)))
  // filter out invalid entries
  const processedEntries = result.filter(e => e != null) as Entry[]
  log(`processed ${name} ${processedEntries.length} entries`)

  // process computeds
  const computedEntries =
    schema.computeds == null
      ? processedEntries
      : await Promise.all(
          processedEntries.map(async entry => {
            const computed = Object.fromEntries(await Promise.all(Object.entries(schema.computeds!).map(async ([name, fn]) => [name, await fn(entry)])))
            return { ...entry, ...computed }
          })
        )
  log(`computed ${name} ${computedEntries.length} entries`)

  return computedEntries
}

// #endregion

// #region main --------------------------------------------------------------------------------------------------------

// prerequisite
await prepare()

// load content
const collections = await Promise.all(
  Object.entries(config.schemas).map(async ([name, schema]): Promise<[string, Entry[]]> => {
    return [name, await load(name, schema)]
  })
)

const data = Object.fromEntries<Entry[]>(collections)

// user callback
config.callback != null && (await config.callback(data))

// write data
await Promise.all(
  Object.entries(data).map(async ([name, entries]) => {
    const output = JSON.stringify(entries, null, 2)
    await fs.writeFile(path.join(config.output.data, name + '.json'), output)
    success(`wrote ${entries.length} ${name} to '${path.join(config.output.data, name + '.json')}'`)
  })
)

// #endregion
