#!/usr/bin/env node
import { parseArgs } from 'node:util'

import { name, version } from '../package.json'
import { build, watch } from './app/build'
import { logger } from './runtime/logger'

import type { LogLevel } from './runtime/logger'

const parseOrExit: typeof parseArgs = config => {
  try {
    return parseArgs(config)
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

const { values, positionals } = parseOrExit({
  allowPositionals: true,
  options: {
    config: { type: 'string', short: 'c' },
    clean: { type: 'boolean', default: false },
    strict: { type: 'boolean', short: 's', default: false },
    verbose: { type: 'boolean', default: false },
    silent: { type: 'boolean', default: false },
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
  --strict             Throw on any schema validation failure
  --verbose            Print additional information
  --silent             Silent mode (no output)
  --debug              Output full error stack trace
  -h, --help           Display this message
  -v, --version        Display version number
`)
  process.exit(0)
}

const command = positionals[0]
if (command != null && command !== 'dev' && command !== 'build') {
  logger.error(`unknown command '${command}', use 'velite build' or 'velite dev'`)
  process.exit(1)
}

const isDev = command === 'dev'
const logLevel: LogLevel = values.silent ? 'silent' : values.verbose ? 'debug' : 'info'

const options = {
  config: values.config,
  clean: values.clean,
  strict: values.strict,
  logLevel
}

const fail = (err: unknown): void => {
  logger.error(err instanceof Error ? err.message : String(err))
  if (values.debug) throw err
  process.exit(1)
}

if (isDev) {
  watch(options).catch(fail)
} else {
  build(options).catch(fail)
}
