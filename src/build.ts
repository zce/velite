import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import glob from 'fast-glob'
import { fromHtml } from 'hast-util-from-html'
import { raw } from 'hast-util-raw'
import { toHtml } from 'hast-util-to-html'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm'
import { toHast } from 'mdast-util-to-hast'
import { toMarkdown } from 'mdast-util-to-markdown'
import { gfm } from 'micromark-extension-gfm'
import { visit } from 'unist-util-visit'
import { VFile } from 'vfile'
import reporter from 'vfile-reporter'
import yaml from 'yaml'

import { resolveConfig } from './config'
import { outputFile } from './static'

import type { Collection } from './types'
import type { ZodType } from 'zod'

declare module 'vfile' {
  interface DataMap {
    result: Collection
  }
}

class File extends VFile {
  private async parseJson(): Promise<Collection> {
    return JSON.parse(this.toString())
  }

  private async parseYaml(): Promise<Collection> {
    return yaml.parse(this.toString())
  }

  private async parseMarkdown(): Promise<Collection> {
    const content = this.toString()
    // https://github.com/vfile/vfile-matter/blob/main/lib/index.js
    const match = content.match(/^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/)
    if (match == null) {
      throw new Error('frontmatter is required')
    }
    const data = yaml.parse(match[1])
    const document = content.slice(match[0].length).trim()
    const mdast = fromMarkdown(document, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })

    // #region format mdast
    // remove comments
    visit(mdast, 'html', node => {
      if (node.value.startsWith('<!--')) {
        node.type = 'text' as any
        node.value = ''
      }
    })
    // flatten image paragraph https://gitlab.com/staltz/mdast-flatten-image-paragraphs/-/blob/master/index.js
    visit(mdast, 'paragraph', node => {
      if (node.children.length === 1 && node.children[0].type === 'image') {
        Object.assign(node, node.children[0], { children: undefined })
      }
    })
    // flatten listitem paragraph https://gitlab.com/staltz/mdast-flatten-listitem-paragraphs/-/blob/master/index.js
    visit(mdast, 'listItem', node => {
      if (node.children.length === 1 && node.children[0].type === 'paragraph') {
        node.type = 'paragraph' as any
        node.children = node.children[0].children as any
      }
    })
    // console.log((await import('unist-util-inspect')).inspect(mdast))
    // #endregion

    // #region extract rel links and copy to public
    const links = new Map()
    visit(mdast, ['link', 'image'], node => {
      'url' in node && links.set(node.url, node)
    })
    visit(mdast, 'html', node => {
      visit(fromHtml(node.value), 'element', ele => {
        if (typeof ele.properties.href === 'string') links.set(ele.properties.href, node)
        if (typeof ele.properties.src === 'string') links.set(ele.properties.src, node)
      })
    })
    await Promise.all(
      [...links.entries()].map(async ([url, node]) => {
        const publicUrl = await outputFile(url, this.path)
        if (publicUrl == null || publicUrl === url) return
        if ('url' in node) {
          // link or image node
          node.url = publicUrl
        }
        if ('value' in node) {
          // html node
          node.value = node.value.replaceAll(url, publicUrl)
        }
      })
    )
    // #endregion

    // generate markdown
    data.raw = toMarkdown(mdast, { extensions: [gfmToMarkdown()] })
    // parse to hast
    const hast = raw(toHast(mdast, { allowDangerousHtml: true }))
    // console.log((await import('unist-util-inspect')).inspect(hast))
    const lines: string[] = []
    visit(hast, 'text', node => {
      lines.push(node.value)
    })
    // extract plain
    data.plain = lines.join('').trim()
    // extract excerpt
    data.excerpt = data.plain.slice(0, 100)
    // generate html
    data.html = toHtml(hast)

    return data
  }

  private async parseDocument(): Promise<Collection> {
    switch (this.extname) {
      case '.json':
        return this.parseJson()
      case '.yaml':
      case '.yml':
        return this.parseYaml()
      case '.md':
      case '.mdx':
        return this.parseMarkdown()
      default:
        throw new Error('no parser for this file')
    }
  }

  async parse(schema: ZodType): Promise<void> {
    try {
      if (this.extname == null) {
        throw new Error('can not parse file without extension')
      }

      const original = await this.parseDocument()
      if (original == null || Object.keys(original).length === 0) {
        throw new Error('no data parsed from this file')
      }

      const list = Array.isArray(original) ? original : [original]
      const processed = await Promise.all(
        list.map(async item => {
          const result = await schema.safeParseAsync(item, { path: [this.path] })
          if (result.success) return result.data
          this.message(result.error.message)
        })
      )
      this.data.result = processed.length === 1 ? processed[0] : processed
    } catch (err: any) {
      this.message(err.message)
    }
  }

  static async create(path: string) {
    const value = await readFile(path, 'utf8')
    return new File({ path, value })
  }
}

type Options = {
  root?: string
  config?: string
  clean?: boolean
  verbose?: boolean
}

export const build = async (options: Options) => {
  const config = await resolveConfig({ root: options.root, filename: options.config })
  // prerequisite
  if (options.clean) {
    // clean output directories if `--clean` requested
    await rm(config.output.data, { recursive: true, force: true })
    await rm(config.output.static, { recursive: true, force: true })
    options.verbose && console.log('cleaned output directories')
  }

  // ensure output directories exist
  await mkdir(config.output.data, { recursive: true })
  await mkdir(config.output.static, { recursive: true })
  options.verbose && console.log('ensured output directories')

  const tasks = Object.entries(config.schemas).map(async ([name, schema]) => {
    const filenames = await glob(schema.pattern, { cwd: config.root, onlyFiles: true, ignore: ['**/_*'] })
    options.verbose && console.debug(`found ${filenames.length} files matching '${schema.pattern}'`)

    const files = await Promise.all(
      filenames.map(async file => {
        const doc = await File.create(join(config.root, file))
        await doc.parse(schema.fields)
        return doc
      })
    )

    const report = reporter(files, { quiet: true })
    report && console.log(report)

    const data = files
      .map(f => f.data.result ?? [])
      .flat()
      .filter(Boolean)

    return [name, data] as const
  })

  const collections = await Promise.all(tasks)

  // user callback
  config.callback != null && (await config.callback(Object.fromEntries(collections)))

  // output data to dist
  await Promise.all(
    collections.map(async ([name, data]) => {
      const output = JSON.stringify(data, null, 2)
      await writeFile(join(config.output.data, name + '.json'), output)
      console.log(`wrote ${data.length} ${name} to '${join(config.output.data, name + '.json')}'`)
    })
  )
}
