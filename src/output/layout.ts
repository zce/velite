import { basename } from 'node:path'

import { hashIdentity, parseRecordId, sanitizeStem } from '../core/ids'

/**
 * Physical output layout helpers.
 *
 * The dev split layout uses record-identity-based file names (not content
 * hashes) so a record's physical path stays stable when only its content
 * changes — keeping collection entry import paths stable and minimizing watch
 * invalidation.
 */

/** Compute the stable physical record file path for a record id. */
export const recordFilePath = (collectionKey: string, recordId: string): string => {
  const { sourceId, key } = parseRecordId(recordId)
  const stem = key === 'default' || key === '' ? sanitizeStem(basename(sourceId)) : sanitizeStem(key)
  const hash = hashIdentity(recordId)
  return `records/${collectionKey}/${stem}.${hash}.json`
}

/** Collection entry file path in the dev split layout. */
export const collectionEntryPath = (collectionKey: string): string => `collections/${collectionKey}.js`

/** Collection data file path in the production single layout. */
export const collectionDataPath = (collectionKey: string): string => `${collectionKey}.json`

/** Entry module path. */
export const entryPath = (): string => 'index.js'

/** Type declaration path. */
export const typesPath = (): string => 'index.d.ts'
