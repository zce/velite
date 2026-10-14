#!/usr/bin/env node
import { parseArgs } from 'node:util'

import { name, version } from '../package.json'
import { build, watch } from './index'

import type { LogLevel } from './runtime'

const parse: typeof parseArgs = config => {
  try {
    return parseArgs(config)
  } catch (err: unknown) {
    console.error((err as Error).message)
    process.exit(1)
  }
}

const { values, positionals } = parse({
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
  --strict             Throw error and terminate process if the build produces any error-level diagnostic
  --debug              Output full error stack trace
  -h, --help           Display this message
  -v, --version        Display version number
`)
  process.exit(0)
}

values.watch = positionals[0] === 'dev' || values.watch

if (positionals[0] !== undefined && positionals[0] !== 'build' && positionals[0] !== 'dev') {
  console.error(`Unknown command: ${positionals[0]}`)
  console.error(`Try 'velite --help' for usage.`)
  process.exit(1)
}

const logLevel: LogLevel = values.silent ? 'silent' : values.verbose ? 'debug' : 'info'

const runBuild = async (): Promise<void> => {
  await build({ config: values.config, clean: values.clean, strict: values.strict, logLevel })
}

const runWatch = async (): Promise<void> => {
  const handle = await watch({ config: values.config, clean: values.clean, strict: values.strict, logLevel })
  await new Promise<void>(resolve => {
    const onSignal = (): void => resolve()
    process.once('SIGINT', onSignal)
    process.once('SIGTERM', onSignal)
  })
  await handle.close()
}

const task = values.watch ? runWatch() : runBuild()

task.catch(err => {
  // Debug mode prints the full stack (the Error's own rendering includes the
  // message); otherwise keep the single-line summary and exit non-zero.
  if (values.debug) console.error(err)
  else console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
