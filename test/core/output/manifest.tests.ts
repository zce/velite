// loadManifest hardening: a corrupted/edited .manifest.json must not be able
// to delete files outside the configured data/assets output directories.
import { equal, ok } from 'node:assert/strict'
import { test } from 'node:test'

import { loadManifest } from '../../../src/core/output/manifest'
import { MemoryFileSystem } from '../../helpers/memory-fs'

const DATA = '/proj/.velite'
const ASSETS = '/proj/public/static'
const MANIFEST = `${DATA}/.manifest.json`

test('loadManifest: filters file entries outside output.data', async () => {
  const fs = new MemoryFileSystem()
  fs.put(
    MANIFEST,
    JSON.stringify({
      files: {
        [`${DATA}/posts.json`]: 'abc', // legal
        '/etc/passwd': 'deadbeef', // attacker-supplied — must drop
        '/proj/something-else.txt': 'beef', // outside data — must drop
        [`${DATA}/sub/foo.json`]: 'feed' // nested under data — legal
      },
      assets: []
    })
  )
  const manifest = await loadManifest(fs, MANIFEST, DATA, ASSETS)
  ok(manifest.files[`${DATA}/posts.json`] === 'abc')
  ok(manifest.files[`${DATA}/sub/foo.json`] === 'feed')
  equal(manifest.files['/etc/passwd'], undefined, '/etc/passwd must be dropped')
  equal(manifest.files['/proj/something-else.txt'], undefined, 'paths outside data must be dropped')
})

test('loadManifest: filters asset entries outside output.assets', async () => {
  const fs = new MemoryFileSystem()
  fs.put(
    MANIFEST,
    JSON.stringify({
      files: {},
      assets: [`${ASSETS}/cover.png`, '/etc/shadow', '/proj/.velite/oops.json', `${ASSETS}/sub/logo.svg`]
    })
  )
  const manifest = await loadManifest(fs, MANIFEST, DATA, ASSETS)
  ok(manifest.assets.includes(`${ASSETS}/cover.png`))
  ok(manifest.assets.includes(`${ASSETS}/sub/logo.svg`))
  ok(!manifest.assets.includes('/etc/shadow'))
  ok(!manifest.assets.includes('/proj/.velite/oops.json'))
})

test('loadManifest: tolerates non-string / malformed entries silently', async () => {
  const fs = new MemoryFileSystem()
  fs.put(
    MANIFEST,
    JSON.stringify({
      files: { [`${DATA}/a.json`]: 123, [`${DATA}/b.json`]: 'ok' }, // non-string digest dropped
      assets: [42, `${ASSETS}/img.png`, null] // non-string asset dropped
    })
  )
  const manifest = await loadManifest(fs, MANIFEST, DATA, ASSETS)
  equal(manifest.files[`${DATA}/a.json`], undefined)
  equal(manifest.files[`${DATA}/b.json`], 'ok')
  ok(manifest.assets.includes(`${ASSETS}/img.png`))
  equal(manifest.assets.length, 1)
})

test('loadManifest: returns empty when the file is absent or unreadable', async () => {
  const fs = new MemoryFileSystem()
  const manifest = await loadManifest(fs, MANIFEST, DATA, ASSETS)
  equal(Object.keys(manifest.files).length, 0)
  equal(manifest.assets.length, 0)
})

test('loadManifest: returns empty when the file is not valid JSON', async () => {
  const fs = new MemoryFileSystem()
  fs.put(MANIFEST, 'not json')
  const manifest = await loadManifest(fs, MANIFEST, DATA, ASSETS)
  equal(Object.keys(manifest.files).length, 0)
  equal(manifest.assets.length, 0)
})

test('loadManifest: rejects `..` traversal segments that escape the data root', async () => {
  const fs = new MemoryFileSystem()
  fs.put(
    MANIFEST,
    JSON.stringify({
      files: {
        [`${DATA}/posts.json`]: 'ok', // legal
        [`${DATA}/../outside.txt`]: 'bad', // normalises to /proj/outside.txt — outside
        [`${DATA}/sub/../../outside.txt`]: 'bad2', // normalises to /proj/outside.txt — outside
        [`${DATA}/sub/../inside.json`]: 'ok2' // normalises to /proj/.velite/inside.json — legal
      },
      assets: []
    })
  )
  const manifest = await loadManifest(fs, MANIFEST, DATA, ASSETS)
  equal(manifest.files[`${DATA}/posts.json`], 'ok')
  equal(manifest.files[`${DATA}/inside.json`], 'ok2', 'normalized to safe inside path')
  equal(manifest.files['/proj/outside.txt'], undefined, 'traversal escape must be rejected')
  equal(manifest.files[`${DATA}/../outside.txt`], undefined, 'unnormalized escape key must be rejected')
})

test('loadManifest: rejects `..` traversal segments in asset paths', async () => {
  const fs = new MemoryFileSystem()
  fs.put(
    MANIFEST,
    JSON.stringify({
      files: {},
      assets: [`${ASSETS}/cover.png`, `${ASSETS}/../../etc/passwd`, `${ASSETS}/sub/../sibling.png`]
    })
  )
  const manifest = await loadManifest(fs, MANIFEST, DATA, ASSETS)
  ok(manifest.assets.includes(`${ASSETS}/cover.png`))
  ok(manifest.assets.includes(`${ASSETS}/sibling.png`), 'normalized legal sub/../sibling is kept')
  ok(!manifest.assets.some(p => p.includes('etc/passwd')), 'traversal to /etc/passwd is rejected')
})

test('loadManifest: rejects sibling directories that merely share a prefix', async () => {
  // `${DATA}-backup/x` starts with `/proj/.velite` as a *substring*, but the
  // segment-based check (`root + '/'`) treats it as a sibling and rejects it.
  const fs = new MemoryFileSystem()
  fs.put(
    MANIFEST,
    JSON.stringify({
      files: { [`${DATA}-backup/x.json`]: 'sneaky', [`${DATA}/legit.json`]: 'ok' },
      assets: [`${ASSETS}-old/x.png`, `${ASSETS}/legit.png`]
    })
  )
  const manifest = await loadManifest(fs, MANIFEST, DATA, ASSETS)
  equal(manifest.files[`${DATA}-backup/x.json`], undefined, 'prefix-sharing sibling rejected (files)')
  equal(manifest.files[`${DATA}/legit.json`], 'ok')
  ok(!manifest.assets.includes(`${ASSETS}-old/x.png`), 'prefix-sharing sibling rejected (assets)')
  ok(manifest.assets.includes(`${ASSETS}/legit.png`))
})

test('loadManifest: rejects the root path itself (no entry can equal the root)', async () => {
  const fs = new MemoryFileSystem()
  fs.put(MANIFEST, JSON.stringify({ files: { [DATA]: 'bad' }, assets: [ASSETS] }))
  const manifest = await loadManifest(fs, MANIFEST, DATA, ASSETS)
  equal(manifest.files[DATA], undefined)
  ok(!manifest.assets.includes(ASSETS))
})
