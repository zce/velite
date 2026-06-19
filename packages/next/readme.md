# @velite/plugin-next

A Next.js plugin for integrating Velite content processing.

Requires Node.js 22.13 or newer, `velite@1.0.0-alpha.2`, and Next.js 16.

## Installation

```bash
npm install -D velite @velite/plugin-next
```

## Usage

```ts
// next.config.ts
import { withVelite } from '@velite/plugin-next'

export default withVelite({
  // other next config here...
})
```

To pass Velite options, create a configured plugin:

```ts
import { createNextPlugin } from '@velite/plugin-next'

const withVelite = createNextPlugin({ config: './velite.config.ts' })

export default withVelite({
  reactStrictMode: true
})
```

## Options

Accepts Velite build options except `watch` and `clean`; the plugin controls those based on the Next.js command.

## License

[MIT](../../license) &copy; [zce](https://zce.me)
