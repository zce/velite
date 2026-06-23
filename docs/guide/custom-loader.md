# Custom Loader

Built-in loaders are:

- `matter-loader`: parse frontmatter and provide content and data
- `json-loader`: parse document as json
- `yaml-loader`: parse document as yaml

Velite supports custom loaders. A loader is an object with a `match` property (file patterns or matcher function) and a `load` method that receives a `LoaderInput` and returns a `LoaderResult`.

In `velite.config.js`:

```js
import toml from 'toml'
import { defineConfig, defineLoader, s } from 'velite'

const tomlLoader = defineLoader({
  match: ['.toml'],
  load: input => {
    const data = toml.parse(input.text)
    return { items: [{ key: 0, data }] }
  }
})

const options = defineCollection({
  pattern: 'options/*.toml',
  schema: s.object({ name: s.string() }),
  loader: tomlLoader
})

export default defineConfig({
  root: 'content',
  collections: { options }
})
```

## Loader Interface

```ts
interface Loader {
  /** File extensions or a custom matcher function. */
  match: string[] | ((path: string) => boolean)
  /** Load file content into structured items. */
  load(input: LoaderInput): LoaderResult | Promise<LoaderResult>
}

interface LoaderInput {
  /** Content-root-relative POSIX source path. */
  path: string
  /** Raw file bytes. */
  bytes: Uint8Array
  /** UTF-8 decoded text (same content as `new TextDecoder().decode(bytes)`). */
  text: string
}

interface LoaderResult {
  /** Parsed items. Each item needs a `key` (unique within the file) and a `data` object. */
  items: LoadedItem[]
}

interface LoadedItem {
  /** Stable identity for this item within its file (used for incremental diffing). */
  key: string | number
  /** The parsed data — validated against the collection schema later. */
  data: unknown
}
```

## `defineLoader`

`defineLoader` is an identity helper for type inference:

```ts
import { defineLoader } from 'velite'

export const tomlLoader = defineLoader({
  match: ['.toml'],
  load: input => ({ items: [{ key: 0, data: toml.parse(input.text) }] })
})
```

> [!TIP]
> Loaders are configured per-collection via the `loader` property, not at the top level of `defineConfig`.
