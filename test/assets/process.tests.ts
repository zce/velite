import { equal } from 'node:assert'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createAssetStore, processAsset } from '../../src/assets'

test('[ext:N] templates use N extension characters', async () => {
  const root = await mkdtemp(join(tmpdir(), 'velite-asset-process-'))
  try {
    const content = join(root, 'content')
    await mkdir(content)
    const page = join(content, 'page.md')
    const image = join(content, 'photo.jpeg')
    await writeFile(page, '')
    await writeFile(image, 'image')

    const url = await processAsset('photo.jpeg', page, '[name].[ext:3]', '/static/', createAssetStore())
    equal(url, '/static/photo.jpe')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
