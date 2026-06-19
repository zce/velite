import type { Data, VFile } from 'vfile'

type Promisable<T> = T | Promise<T>

declare module 'vfile' {
  interface DataMap {
    /**
     * original data loaded from file
     */
    data: unknown
    /**
     * content without frontmatter
     */
    content: string
    /**
     * content plain text
     */
    plain: string
  }
}

/**
 * File data loader
 */
export interface VeliteLoader {
  /**
   * File test regexp
   * @example /\.md$/
   */
  test: RegExp
  /**
   * Load file data from file.value
   * @param file vfile
   */
  load: (file: VFile) => Promisable<Data>
}

/**
 * Define a loader (identity function for type inference)
 */
export const defineLoader = <T extends VeliteLoader>(loader: T): T => loader
