import { createHash } from 'node:crypto'

export const log = (msg: string) => process.argv.includes('--verbose') && console.log('\x1b[2m%s\x1b[0m', msg)

export const warn = (msg: string) => console.warn('\x1b[33m%s\x1b[0m', msg)

export const error = (msg: string) => console.error('\x1b[31m%s\x1b[0m', msg)

export const success = (msg: string) => console.log('\x1b[32m%s\x1b[0m', msg)

export const md5 = (data: string | Buffer) => createHash('md5').update(data).digest('hex').slice(0, 8)

const copiedFiles = new Set<string>()
/**
 * Copy file to public directory
 * @param from original file path
 * @param ref reference path
 * @returns public url of copied file
 */
export const copyToPublic = async (from: string, ref?: string): Promise<string | undefined> => {
  // if (ref == null) return
  // // ignore absolute url
  // if (/^(https?:\/\/|data:|mailto:|\/)/.test(ref)) return ref
  // // ignore empty or markdown file
  // if (['', '.md'].includes(path.extname(ref))) return ref
  // try {
  //   const target = path.join(config.root, from, '..', ref)
  //   const hash = md5(await fs.readFile(target))
  //   const name = hash + path.extname(ref)
  //   if (copiedFiles.has(name)) return config.output.publicUrl + name
  //   copiedFiles.add(name) // not await works, but await not works, becareful if copy failed
  //   await fs.copyFile(target, path.join(config.output.public, name))
  //   log(`copied '${ref}' -> '${name}'`)
  //   return config.output.publicUrl + name
  // } catch (err: any) {
  //   warn(`copied '${ref}' failed: '${err.message}'`)
  //   return ref
  // }
  return
}
