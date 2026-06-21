/**
 * Public output configuration.
 *
 * Physical output layout (single vs split) is intentionally not part of the
 * 1.0 user-facing config; it is an internal strategy selected during output
 * planning (split for dev/watch, single for production one-shot builds).
 */
export interface OutputConfig {
  /** Output directory of the data files (relative to the config file). @default '.velite' */
  data: string
  /** Directory of the assets (relative to the config file). @default 'public/static' */
  assets: string
  /** Public base path of the assets. @default '/static/' */
  base: string
  /** Output entry file format. @default 'esm' */
  format: 'esm' | 'cjs'
  /** Whether to clean the output directories before build. @default false */
  clean: boolean
}
