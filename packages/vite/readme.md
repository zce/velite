# @velite/plugin-vite

A Vite plugin for integrating Velite content processing.

Requires Node.js 22.13 or newer, `velite@1.0.0-alpha.2`, and Vite 5 through Vite 8.

## Installation

```bash
npm install -D velite @velite/plugin-vite
```

## Usage

```ts
// vite.config.ts
import velite from '@velite/plugin-vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    velite({
      // Path to velite config file
      config: 'velite.config.ts'
    })
  ]
})
```

## Options

- Accepts Velite options except `watch`; the plugin starts watch mode for the Vite dev server and runs a one-off build for production builds.
- `config`: Path to the Velite config file.

## License

[MIT](../../license) &copy; [zce](https://zce.me)
