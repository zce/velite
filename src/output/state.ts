/**
 * Output cache tracking content already written to disk.
 *
 * Stored on the session (or on watch state) so that independent `build()`
 * calls do not skip writes when the user has deleted the output directory
 * between builds. Asset output is intentionally not in this cache: assets are
 * always copied from the current `AssetStore`.
 */
export interface OutputState {
  /** Map from output path to the most recently emitted content. */
  emitted: Map<string, string>
}
