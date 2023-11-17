#!/usr/bin/env node
import cac from 'cac'

import { name, version } from '../package.json'
import { build } from './build'

const cli = cac(name).version(version).help()

cli
  .command('', 'Build contents for production')
  .alias('build')
  .option('-c, --config <path>', 'Use specified config file')
  .option('--clean', 'Clean output directory before build')
  .option('--watch', 'Watch for changes and rebuild')
  .option('--verbose', 'Print additional information')
  .option('--debug', 'Print debug information')
  .action(({ config, clean, watch, verbose }) => {
    return build({ config, clean, watch, verbose })
  })

const onError = (err: Error): void => {
  if (cli.options.debug) console.error(err)
  console.error('Exception occurred: ' + err.message)
  process.exit(1)
}

process.on('uncaughtException', onError)
process.on('unhandledRejection', onError)

cli.parse()
