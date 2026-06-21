import { watch } from './index'

const main = async (): Promise<number> => {
  const command = process.argv[2] ?? 'build'
  if (command === 'build') {
    const { build } = await import('./index')
    const result = await build()
    const errors = result.diagnostics.filter(d => d.level === 'error').length
    return errors > 0 ? 1 : 0
  }
  if (command === 'dev') {
    const handle = await watch()
    await new Promise<void>(resolve => {
      process.on('SIGINT', () => resolve())
      process.on('SIGTERM', () => resolve())
    })
    await handle.close()
    return 0
  }
  console.error(`unknown command: ${command}`)
  return 1
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
