#!/usr/bin/env node

/**
 * @file CLI entry point
 */
import cac from 'cac'

import { name, version } from '../package.json'
import { build } from './builder'

const cli = cac(name).version(version).help()

cli
  .command('build', 'Build contents for production')
  .option('-c, --config <path>', 'Use specified config file')
  .option('--clean', 'Clean output directory before build')
  .option('--verbose', 'Print additional information')
  .option('--debug', 'Print debug information')
  .action(({ config, clean, verbose }) => {
    return build({ config, clean, verbose })
  })

const onError = (err: Error): void => {
  if (cli.options.debug) console.error(err)
  console.error('Exception occurred: ' + err.message)
  process.exit(1)
}

process.on('uncaughtException', onError)
process.on('unhandledRejection', onError)

cli.parse()
