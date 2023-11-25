import cac from 'cac'

import { name, version } from '../package.json'
import { build } from './build'
import { logger } from './logger'

const cli = cac(name).version(version).help()

cli
  .command('', 'Build contents for production')
  .alias('build')
  .option('-c, --config <path>', 'Use specified config file')
  .option('--clean', 'Clean output directory before build')
  .option('--watch', 'Watch for changes and rebuild')
  .option('--verbose', 'Print additional information')
  .option('--silent', 'Print nothing')
  .option('--debug', 'Print complete error stack when error occurs (CLI only)')
  .action(({ config, clean, watch, verbose, silent }) => {
    const logLevel = silent ? 'silent' : verbose ? 'debug' : 'info'
    return build({ config, clean, watch, logLevel })
  })

const onError = (err: Error): void => {
  logger.error(cli.options.debug ? err : (err.message as any))
  process.exit(1)
}

process.on('uncaughtException', onError)
process.on('unhandledRejection', onError)

cli.parse()
