// Contract tests for the sharp-backed image adapter. These exercise the real
// `sharp` runtime (a required dependency) — the goal is to confirm the
// metadata-short-circuit path in `blurDataURL` produces the same data url as
// the internal-probe path, so callers (notably the asset derivation) can
// safely pass pre-probed metadata to avoid the duplicate decode.
//
// `s.image` end-to-end behaviour is covered by image-build.tests.ts via a stub;
// this file pins the adapter contract directly so a regression in the
// optimization shows up at the adapter boundary, not as a build-output drift.
import { equal, ok } from 'node:assert/strict'
import { before, test } from 'node:test'
import sharp from 'sharp'

import { sharpImageProcessor } from '../../../../src/runtime/adapters/node/image'

// A real, sharp-encoded PNG so this file does not need to ship a hand-crafted
// fixture (and risk CRC drift). Generated once per test run.
let PNG_4x2: Uint8Array

before(async () => {
  const buf = await sharp({
    create: { width: 4, height: 2, channels: 3, background: { r: 200, g: 30, b: 30 } }
  })
    .png()
    .toBuffer()
  PNG_4x2 = new Uint8Array(buf)
})

test('sharpImageProcessor.probe: returns real dimensions and format for a real png', async () => {
  const result = await sharpImageProcessor.probe(PNG_4x2)
  equal(result.width, 4)
  equal(result.height, 2)
  equal(result.format, 'png')
})

test('sharpImageProcessor.blurDataURL: produces a webp data url for a real png', async () => {
  const url = await sharpImageProcessor.blurDataURL(PNG_4x2)
  ok(url.startsWith('data:image/webp;base64,'), `got: ${url.slice(0, 40)}`)
  ok(url.length > 'data:image/webp;base64,'.length)
})

test('sharpImageProcessor.blurDataURL: pre-probed metadata short-circuits the internal probe and yields the same output', async () => {
  // The contract: when the caller supplies dimensions, the adapter must skip
  // its own metadata read. We can't directly observe the elision, but if the
  // short-circuit *misread* the metadata-arg path the output would differ.
  // Equal outputs across the two call shapes pins the optimization.
  const withoutMeta = await sharpImageProcessor.blurDataURL(PNG_4x2)
  const withMeta = await sharpImageProcessor.blurDataURL(PNG_4x2, { width: 4, height: 2 })
  equal(withMeta, withoutMeta)
})

test('sharpImageProcessor.blurDataURL: dimensionless metadata short-circuits to empty string (no sharp work)', async () => {
  // A caller passing (0, 0) — e.g. an SVG without intrinsic size that probed
  // to zeros — must not divide by zero or invoke sharp's resize pipeline.
  const url = await sharpImageProcessor.blurDataURL(PNG_4x2, { width: 0, height: 0 })
  equal(url, '')
})
