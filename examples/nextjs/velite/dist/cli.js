import { createRequire } from 'module'

import { build, logger, name, version } from './chunk-TIR7LQKK.js'

import './chunk-ZWVIC74Y.js'

import { parseArgs } from 'util'

createRequire(import.meta.url)
var parse = config => {
  try {
    return parseArgs(config)
  } catch (err) {
    logger.error(err.message)
    process.exit(1)
  }
}
var { values, positionals } = parse({
  allowPositionals: true,
  options: {
    config: { type: 'string', short: 'c' },
    clean: { type: 'boolean', default: false },
    watch: { type: 'boolean', default: false },
    verbose: { type: 'boolean', default: false },
    silent: { type: 'boolean', default: false },
    strict: { type: 'boolean', short: 's', default: false },
    debug: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'v', default: false }
  }
})
if (values.version) {
  console.log(`${name}/${version}`)
  process.exit(0)
}
if (values.help) {
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
  --strict             Throw error and terminate process if any schema validation fails
  --debug              Output full error stack trace
  -h, --help           Display this message
  -v, --version        Display version number
`)
  process.exit(0)
}
values.watch = positionals[0] === 'dev' || values.watch
var logLevel = values.silent ? 'silent' : values.verbose ? 'debug' : 'info'
build({ ...values, logLevel }).catch(err => {
  logger.error(err.message)
  if (values.debug) throw err
  process.exit(1)
})
