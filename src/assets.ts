import { createHash } from 'node:crypto'
import { copyFile, readFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import sharp from 'sharp'
import { visit } from 'unist-util-visit'

import { getConfig } from './config'

import type { Element, Root as Hast, Nodes as HNodes } from 'hast'
import type { Root as Mdast, Node } from 'mdast'
import type { VFile } from 'vfile'
import type { Image } from './types'

const assets = new Map<string, string>()

// https://github.com/sindresorhus/is-absolute-url/blob/main/index.js
const absoluteUrlRegex = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/
const absolutePathRegex = /^(\/[^/\\]|[a-zA-Z]:\\)/

/**
 * validate if a url is a relative path
 * @param url url to validate
 * @returns true if the url is a relative path
 */
const isStaticPath = (url: string): boolean => {
  if (url.startsWith('#')) return false // ignore hash anchor
  if (url.startsWith('?')) return false // ignore query
  if (url.startsWith('//')) return false // ignore protocol relative urlet name
  if (absoluteUrlRegex.test(url)) return false // ignore absolute url
  if (absolutePathRegex.test(url)) return false // ignore absolute path
  return !getConfig().output.ignore.includes(extname(url).slice(1)) // ignore file extensions
}

/**
 * get public directory
 * @param buffer image buffer
 * @returns image object with blurDataURL
 */
const getImageMetadata = async (buffer: Buffer): Promise<Omit<Image, 'src'> | undefined> => {
  const img = sharp(buffer)
  const { width, height } = await img.metadata()
  if (width == null || height == null) return
  const aspectRatio = width / height
  const blurWidth = 8
  const blurHeight = Math.round(blurWidth / aspectRatio)
  const blurImage = await img.resize(blurWidth, blurHeight).webp({ quality: 1 }).toBuffer()
  const blurDataURL = `data:image/webp;base64,${blurImage.toString('base64')}`
  return { height, width, blurDataURL, blurWidth, blurHeight }
}

/**
 * process assets reference of a file
 * @param ref relative path of the referenced file
 * @param path source file path
 * @param isImage process as image and return image object with blurDataURL
 * @returns reference public url or image object
 */
export const process = async <T extends string | undefined, U extends true | undefined = undefined>(
  ref: T,
  fromPath: string,
  isImage?: U
): Promise<T extends undefined ? undefined : U extends true ? Image | T : T> => {
  if (ref == null) return ref as any

  if (!isStaticPath(ref)) return ref as any

  const { output } = getConfig()

  const from = resolve(fromPath, '..', ref)
  const source = await readFile(from)

  const filename = output.filename.replace(/\[(name|hash|ext)(:(\d+))?\]/g, (substring, ...groups) => {
    const key = groups[0]
    const length = groups[2] == null ? undefined : parseInt(groups[2])
    switch (key) {
      case 'name':
        return basename(ref, extname(ref)).slice(0, length)
      case 'hash':
        // TODO: md5 is slow and not-FIPS compliant, consider using sha256
        // https://github.com/joshwiens/hash-perf
        // https://stackoverflow.com/q/2722943
        // https://stackoverflow.com/q/14139727
        return createHash('md5').update(source).digest('hex').slice(0, length)
      case 'ext':
        return extname(ref).slice(1).slice(0, length)
    }
    return substring
  })

  assets.set(filename, from)

  if (isImage !== true) {
    return (output.base + filename) as any
  }

  const metadata = await getImageMetadata(source)
  if (metadata == null) throw new Error(`invalid image: ${from}`)
  return { src: output.base + filename, ...metadata } as any
}

export const extractHastLinkedFiles = async (tree: HNodes, from: string) => {
  const links = new Map<string, Element[]>()
  const linkedPropertyNames = ['href', 'src', 'poster']
  visit(tree, 'element', node => {
    linkedPropertyNames.forEach(name => {
      const value = node.properties[name]
      if (typeof value === 'string' && isStaticPath(value)) {
        const elements = links.get(value) ?? []
        elements.push(node)
        links.set(value, elements)
      }
    })
  })
  await Promise.all(
    Array.from(links.entries()).map(async ([url, elements]) => {
      const publicUrl = await process(undefined, from)
      if (publicUrl == null || publicUrl === url) return
      elements.forEach(node => {
        linkedPropertyNames.forEach(name => {
          if (name in node.properties) {
            node.properties[name] = publicUrl
          }
        })
      })
    })
  )
}

/**
 * rehype plugin to copy linked files to public path and replace their urls with public urls
 */
export const rehypeCopyLinkedFiles = () => async (tree: Hast, file: VFile) => extractHastLinkedFiles(tree, file.path)

/**
 * remark plugin to copy linked files to public path and replace their urls with public urls
 */
export const remarkCopyLinkedFiles = () => async (tree: Mdast, file: VFile) => {
  const links = new Map<string, Node[]>()
  const linkedPropertyNames = ['href', 'src', 'poster']
  visit(tree, ['link', 'image', 'definition'], (node: any) => {
    if (isStaticPath(node.url)) {
      const nodes = links.get(node.url) || []
      nodes.push(node)
      links.set(node.url, nodes)
    }
  })
  visit(tree, 'mdxJsxFlowElement', node => {
    node.attributes.forEach((attr: any) => {
      if (linkedPropertyNames.includes(attr.name) && typeof attr.value === 'string' && isStaticPath(attr.value)) {
        const nodes = links.get(attr.value) || []
        nodes.push(node)
        links.set(attr.value, nodes)
      }
    })
  })
  await Promise.all(
    Array.from(links.entries()).map(async ([url, nodes]) => {
      const publicUrl = await process(url, file.path)
      if (publicUrl == null || publicUrl === url) return
      nodes.forEach((node: any) => {
        if ('url' in node && node.url === url) {
          node.url = publicUrl
          return
        }
        node.attributes.forEach((attr: any) => {
          linkedPropertyNames.forEach(name => {
            if (attr.name === name && attr.value === url) {
              attr.value = publicUrl
            }
          })
        })
      })
    })
  )
}

/**
 * output all assets to output directory
 * @param dir assets output directory
 */
export const outputAssets = async (): Promise<void[]> => Promise.all(Array.from(assets.entries()).map(([name, from]) => copyFile(from, join(getConfig().output.assets, name))))
