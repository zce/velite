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
import yaml from 'yaml'

import { outputFile } from './static'

export type Loader = {
  name: string
  test: RegExp
  load: (file: VFile) => Promise<unknown>
}

const loaders: Loader[] = []

export const addLoader = (loader: Loader) => {
  loaders.unshift(loader)
}

export const removeLoader = (name: string) => {
  const loader = loaders.find(loader => loader.name === name)
  loader && loaders.splice(loaders.indexOf(loader), 1)
}

export const load = (file: VFile) => {
  const loader = loaders.find(loader => loader.test.test(file.path))
  if (loader == null) {
    throw new Error(`no loader found for '${file.path}'`)
  }
  return loader.load(file)
}

addLoader({
  name: 'json',
  test: /\.json$/,
  load: async file => {
    return JSON.parse(file.toString())
  }
})

addLoader({
  name: 'yaml',
  test: /\.(yaml|yml)$/,
  load: async file => {
    return yaml.parse(file.toString())
  }
})

addLoader({
  name: 'markdown',
  test: /\.(md|mdx)$/,
  load: async file => {
    const content = file.toString()
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
        const publicUrl = await outputFile(url, file.path)
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
})
