import { equal } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { VFile } from 'vfile'

import { createAssetStore, remarkCopyLinkedFiles } from '../../src/assets'

test('remarkCopyLinkedFiles rewrites inline MDX JSX asset attributes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'velite-mdx-inline-assets-'))
  try {
    const content = join(root, 'content')
    await mkdir(content)
    const page = join(content, 'page.mdx')
    await writeFile(page, '')
    await writeFile(join(content, 'hero.png'), 'image')

    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'mdxJsxTextElement',
              name: 'img',
              attributes: [{ type: 'mdxJsxAttribute', name: 'src', value: './hero.png' }],
              children: []
            }
          ]
        }
      ]
    } as any

    await remarkCopyLinkedFiles({ assets: createAssetStore(), base: '/static/', name: '[name].[ext]', format: 'esm' })(tree, new VFile({ path: page }))

    equal(tree.children[0].children[0].attributes[0].value, '/static/hero.png')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
