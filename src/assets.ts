import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import sharp from 'sharp'
import { visit } from 'unist-util-visit'

import type { Element, Root as Hast } from 'hast'
import type { Root as Mdast, Node } from 'mdast'
import type { Plugin } from 'unified'

/**
 * Image object with metadata & blur image
 */
export interface Image {
  /**
   * public url of the image
   */
  src: string
  /**
   * image width
   */
  width: number
  /**
   * image height
   */
  height: number
  /**
   * blurDataURL of the image
   */
  blurDataURL: string
  /**
   * blur image width
   */
  blurWidth: number
  /**
   * blur image height
   */
  blurHeight: number
}

export const assets = new Map<string, string>()

// https://github.com/sindresorhus/is-absolute-url/blob/main/index.js
const ABS_URL_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/
const ABS_PATH_RE = /^(\/[^/\\]|[a-zA-Z]:\\)/

/**
 * validate if a url is a relative path
 * @param url url to validate
 * @returns true if the url is a relative path
 */
export const isRelativePath = (url: string): boolean => {
  if (url.startsWith('#')) return false // ignore hash anchor
  if (url.startsWith('?')) return false // ignore query
  if (url.startsWith('//')) return false // ignore protocol relative urlet name
  if (ABS_URL_RE.test(url)) return false // ignore absolute url
  if (ABS_PATH_RE.test(url)) return false // ignore absolute path
  return true
}

/**
 * get public directory
 * @param buffer image buffer
 * @returns image object with blurDataURL
 */
export const getImageMetadata = async (buffer: Buffer): Promise<Omit<Image, 'src'> | undefined> => {
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
 * process referenced asset of a file
 * @param input relative path of the asset
 * @param from source file path
 * @param filename output filename template
 * @param baseUrl output public base url
 * @param isImage process as image and return image object with blurDataURL
 * @returns reference public url or image object
 */
export const processAsset = async <T extends true | undefined = undefined>(
  input: string,
  from: string,
  filename: string,
  baseUrl: string,
  isImage?: T
): Promise<T extends true ? Image : string> => {
  const path = resolve(from, '..', input)
  const buffer = await readFile(path)
  const ext = extname(input)

  const name = filename.replace(/\[(name|hash|ext)(:(\d+))?\]/g, (substring, ...groups) => {
    const key = groups[0]
    const length = groups[2] == null ? undefined : parseInt(groups[2])
    switch (key) {
      case 'name':
        return basename(input, ext).slice(0, length)
      case 'hash':
        // TODO: md5 is slow and not-FIPS compliant, consider using sha256
        // https://github.com/joshwiens/hash-perf
        // https://stackoverflow.com/q/2722943
        // https://stackoverflow.com/q/14139727
        return createHash('md5').update(buffer).digest('hex').slice(0, length)
      case 'ext':
        return ext.slice(1, length)
    }
    return substring
  })

  const src = baseUrl + name
  assets.set(name, path)

  if (isImage !== true) return src as T extends true ? Image : string

  const metadata = await getImageMetadata(buffer)
  if (metadata == null) throw new Error(`invalid image: ${from}`)
  return { src, ...metadata } as T extends true ? Image : string
}

/**
 * rehype (markdown) plugin to copy linked files to public path and replace their urls with public urls
 */
export const rehypeCopyLinkedFiles: Plugin<[string, string], Hast> = (filename, base) => async (tree, file) => {
  const links = new Map<string, Element[]>()
  const linkedPropertyNames = ['href', 'src', 'poster']
  visit(tree, 'element', node => {
    linkedPropertyNames.forEach(name => {
      const value = node.properties[name]
      if (typeof value === 'string' && isRelativePath(value)) {
        const elements = links.get(value) ?? []
        elements.push(node)
        links.set(value, elements)
      }
    })
  })
  await Promise.all(
    Array.from(links.entries()).map(async ([url, elements]) => {
      const publicUrl = await processAsset(url, file.path, filename, base)
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
 * remark (mdx) plugin to copy linked files to public path and replace their urls with public urls
 */
export const remarkCopyLinkedFiles: Plugin<[string, string], Mdast> = (filename, base) => async (tree, file) => {
  const links = new Map<string, Node[]>()
  const linkedPropertyNames = ['href', 'src', 'poster']
  visit(tree, ['link', 'image', 'definition'], (node: any) => {
    if (isRelativePath(node.url)) {
      const nodes = links.get(node.url) || []
      nodes.push(node)
      links.set(node.url, nodes)
    }
  })
  visit(tree, 'mdxJsxFlowElement', node => {
    node.attributes.forEach((attr: any) => {
      if (linkedPropertyNames.includes(attr.name) && typeof attr.value === 'string' && isRelativePath(attr.value)) {
        const nodes = links.get(attr.value) || []
        nodes.push(node)
        links.set(attr.value, nodes)
      }
    })
  })
  await Promise.all(
    Array.from(links.entries()).map(async ([url, nodes]) => {
      const publicUrl = await processAsset(url, file.path, filename, base)
      if (publicUrl == null || publicUrl === url) return
      nodes.forEach((node: any) => {
        if (node.url === url) {
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
