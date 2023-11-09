#!/usr/bin/env node
import cac from 'cac'
import { build } from '.'
import { name, version } from '../package.json'

const cli = cac(name)

cli
  .command('build', 'Build contents for production')
  .option('-c, --config', 'Use specified config file')
  .option('--clear', 'Clear output directory before build')
  .option('--verbose', 'Print additional information')
  .option('--debug', 'Print debug information')
  .action(build)

cli.help().version(version).parse()

// https://github.com/cacjs/cac#error-handling
const onError = (err: Error): void => {
  // output details when exception occurs
  if (cli.options.debug) console.error(err)
  console.error('Exception occurred: ' + err.message)
  process.exit(1)
}

process.on('uncaughtException', onError)
process.on('unhandledRejection', onError)
