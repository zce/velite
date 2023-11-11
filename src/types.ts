/**
 * single data from document
 */
export type Entry = Record<string, unknown>

/**
 * list of data from document
 */
export type Entries = Entry[]

/**
 * data from document
 */
export type Collection = Entry | Entries

/**
 * all data from document, key is collection name
 */
export type Collections = Record<string, Collection>

/**
 * image object with blurDataURL
 */
export type Image = {
  src: string
  height: number
  width: number
  blurDataURL: string
  blurWidth: number
  blurHeight: number
}
