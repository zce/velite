#!/usr/bin/env node

import cac from 'cac'
import { dev, build } from '.'
import { name, version } from '../package.json'

const cli = cac(name)

cli
  .command('', 'Create new project from a template')
  .alias('dev')
  .option('-c, --config', 'Use specified config file')
  .option('-b, --base', 'Content base path')
  .option('--clearCache', 'Clear cache')
  .example('  # with an official template')
  .example(`  $ ${name} <template> [project]`)
  .example('  # with a custom github repo')
  .example(`  $ ${name} <owner>/<repo> [project]`)
  .action(dev)

cli.help().version(version).parse()

// https://github.com/cacjs/cac#error-handling
const onError = (err: Error): void => {
  // output details when exception occurs
  cli.options.debug as boolean && console.error(err)
  console.error('Exception occurred: ' + err.message)
  process.exit(1)
}

process.on('uncaughtException', onError)
process.on('unhandledRejection', onError)
