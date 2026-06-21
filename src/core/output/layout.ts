// Physical output layout helpers.
//
// Ported from src/output/layout.ts onto the new identity helpers. Paths are
// posix-relative (joined to the data dir by the writer).
//
// The dev split layout uses record-identity-based file names (not content
// hashes) so a record's physical path stays stable when only its content
// changes — keeping collection entry import paths stable and minimizing watch
// invalidation.

import { basename, hashIdentity, parseRecordId, sanitizeStem } from '../util/identity'

/**
 * Compute the stable physical record file path for a record id (an EntryId).
 *
 * The stem is derived from the record key (or the source file's basename for
 * single-record sources); the disambiguating suffix is an identity hash, so the
 * path is invariant under content-only changes.
 */
export const recordFilePath = (collectionKey: string, recordId: string): string => {
  const { sourceId, key } = parseRecordId(recordId)
  const stem = key === 'default' || key === '' ? sanitizeStem(basename(sourceId)) : sanitizeStem(key)
  const digest = hashIdentity(recordId)
  return `records/${collectionKey}/${stem}.${digest}.json`
}

/** Collection entry file path in the dev split layout. */
export const collectionEntryPath = (collectionKey: string): string => `collections/${collectionKey}.js`

/** Collection data file path in the production single layout. */
export const collectionDataPath = (collectionKey: string): string => `${collectionKey}.json`

/** Entry module path. */
export const entryPath = (): string => 'index.js'

/** Type declaration path. */
export const typesPath = (): string => 'index.d.ts'
