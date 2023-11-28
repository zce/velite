import mri from 'mri'

import { name, version } from '../package.json'
import { build } from './build'
import { logger } from './logger'

const argv = process.argv.slice(2)

const { _, ...options } = mri(argv, {
  alias: { c: 'config', h: 'help', v: 'version' },
  boolean: ['clean', 'watch', 'verbose', 'silent', 'debug']
})

const command = _[0] ?? 'build'

if (options.version) {
  console.log(`${name}/${version}`)
  process.exit(0)
}

if (options.help) {
  console.log(`
${name}/${version}

Usage:
  $ velite <command> [options]

Commands:
  build  Build contents for production
  dev    Build contents with watch mode

Options:
  -c, --config <path>  Use specified config file
  --clean              Clean output directory before build
  --watch              Watch for changes and rebuild
  --verbose            Print additional information
  --silent             Silent mode (no output)
  --debug              Output full error stack trace
  -h, --help           Display this message
  -v, --version        Display version number
`)
  process.exit(0)
}

try {
  const logLevel = options.silent ? 'silent' : options.verbose ? 'debug' : 'info'
  options.watch = command === 'dev' || options.watch
  await build({ ...options, logLevel })
} catch (err: any) {
  logger.error(err.message)
  if (options.debug) throw err
  process.exit(1)
}
