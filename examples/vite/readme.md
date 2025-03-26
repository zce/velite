# Vite + MDX + Velite

A template with Vite, [Velite](https://github.com/zce/velite).

[MDX Example](content/pages/about/index.mdx)

## Recipes

#### Using @velite/plugin-vite:

**vite.config.ts**:

```ts
import velite from '@velite/plugin-vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [velite()]
})
```
