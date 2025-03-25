# @velite/plugin-vite

A Vite plugin for integrating Velite content processing.

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

- `config`: Path to velite.config.ts file (default: 'velite.config.ts')

## License

[MIT](../../license) &copy; [zce](https://zce.me)
