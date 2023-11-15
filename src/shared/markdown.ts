import z from 'zod'

interface MarkdownBody {
  raw: string
  plain: string
  excerpt: string
  html: string
}

export const markdown = () =>
  z.string().transform((value, ctx): MarkdownBody => {
    return {} as any
  })

// addLoader({
//   name: 'markdown',
//   test: /\.(md|mdx)$/,
//   load: async file => {
//     const content = file.toString()
//     // https://github.com/vfile/vfile-matter/blob/main/lib/index.js
//     const match = content.match(/^---(?:\r?\n|\r)(?:([\s\S]*?)(?:\r?\n|\r))?---(?:\r?\n|\r|$)/)
//     if (match == null) {
//       throw new Error('frontmatter is required')
//     }
//     const data = yaml.parse(match[1])
//     const document = content.slice(match[0].length).trim()
//     const mdast = fromMarkdown(document, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })

//     // #region format mdast
//     // remove comments
//     visit(mdast, 'html', node => {
//       if (node.value.startsWith('<!--')) {
//         node.type = 'text' as any
//         node.value = ''
//       }
//     })
//     // flatten image paragraph https://gitlab.com/staltz/mdast-flatten-image-paragraphs/-/blob/master/index.js
//     visit(mdast, 'paragraph', node => {
//       if (node.children.length === 1 && node.children[0].type === 'image') {
//         Object.assign(node, node.children[0], { children: undefined })
//       }
//     })
//     // flatten listitem paragraph https://gitlab.com/staltz/mdast-flatten-listitem-paragraphs/-/blob/master/index.js
//     visit(mdast, 'listItem', node => {
//       if (node.children.length === 1 && node.children[0].type === 'paragraph') {
//         node.children = node.children[0].children as any
//       }
//     })
//     // console.log((await import('unist-util-inspect')).inspect(mdast))
//     // #endregion

//     // #region extract rel links and copy to public
//     const links = new Map()
//     visit(mdast, ['link', 'image'], node => {
//       'url' in node && links.set(node.url, node)
//     })
//     visit(mdast, 'html', node => {
//       visit(fromHtml(node.value), 'element', ele => {
//         if (typeof ele.properties.href === 'string') links.set(ele.properties.href, node)
//         if (typeof ele.properties.src === 'string') links.set(ele.properties.src, node)
//       })
//     })
//     await Promise.all(
//       [...links.entries()].map(async ([url, node]) => {
//         const publicUrl = await outputFile(url, file.path)
//         if (publicUrl == null || publicUrl === url) return
//         if ('url' in node) {
//           // link or image node
//           node.url = publicUrl
//         }
//         if ('value' in node) {
//           // html node
//           node.value = node.value.replaceAll(url, publicUrl)
//         }
//       })
//     )
//     // #endregion

//     // apply mdast plugins
//     await Promise.all(plugins.map(async p => p.type === 'mdast' && (await p.apply(mdast, data, visit))))

//     // generate markdown
//     data.raw = toMarkdown(mdast, { extensions: [gfmToMarkdown()] })
//     // parse to hast
//     const hast = raw(toHast(mdast, { allowDangerousHtml: true }))

//     // apply hast plugins
//     await Promise.all(plugins.map(async p => p.type === 'hast' && (await p.apply(hast, data, visit))))

//     // console.log((await import('unist-util-inspect')).inspect(hast))
//     const lines: string[] = []
//     visit(hast, 'text', node => {
//       lines.push(node.value)
//     })
//     // extract plain
//     data.plain = lines.join('').trim()
//     // extract excerpt
//     data.excerpt = data.plain.slice(0, 100)
//     // generate html
//     data.html = toHtml(hast)

//     return data
//   }
// })
