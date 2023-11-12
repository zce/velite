#!/usr/bin/env node
import cac from 'cac'

import { name, version } from '../package.json'
import { build } from './build'
import { image } from './image'

const cli = cac(name).version(version).help()

cli.option('-c, --config <path>', 'Use specified config file').option('--verbose', 'Print additional information')

cli
  .command('[root]', 'Build contents for production')
  .alias('build')
  .option('--clean', 'Clean output directory before build')
  .action((root, { config, clean, verbose }) => {
    return build({ root, config, clean, verbose })
  })

cli
  .command('image [dir]', 'Optimize images for production')
  .option('-p, --pattern <pattern>', 'Image pattern (default: **/*.{jpg,jpeg,png,gif,webp})')
  .option('-s, --sizes <sizes>', 'Image sizes (default: 640, 720, 1280, 1600)')
  .option('-q, --quality <quality>', 'Image quality (default: 80)')
  .action((dir, { config, pattern, sizes, quality, verbose }) => {
    if (typeof sizes === 'string') sizes = [...new Set(sizes.split(',').map(size => parseInt(size, 10)))]
    return image({ dir, config, pattern, sizes, quality, verbose })
  })

const onError = (err: Error): void => {
  if (cli.options.debug) console.error(err)
  console.error('Exception occurred: ' + err.message)
  process.exit(1)
}

process.on('uncaughtException', onError)
process.on('unhandledRejection', onError)

cli.parse()

if (cli.matchedCommand == null) {
  cli.outputHelp()
  process.exit(0)
}
