#!/usr/bin/env node
import cac from 'cac'

import { name, version } from '../package.json'
import { build } from './build'
import { logger, LogLevel, setLogLevel } from './logger'

const cli = cac(name).version(version).help()

cli
  .command('', 'Build contents for production')
  .alias('build')
  .option('-c, --config <path>', 'Use specified config file')
  .option('--clean', 'Clean output directory before build')
  .option('--watch', 'Watch for changes and rebuild')
  .option('--verbose', 'Print additional information')
  .option('--debug', 'Print debug information')
  .action(({ config, clean, watch }) => {
    return build({ config, clean, watch })
  })

const onError = (err: Error): void => {
  logger.error(cli.options.debug ? err : (err.message as any))
  process.exit(1)
}

process.on('uncaughtException', onError)
process.on('unhandledRejection', onError)

cli.parse()

setLogLevel(cli.options.verbose ? LogLevel.DEBUG : LogLevel.INFO)
