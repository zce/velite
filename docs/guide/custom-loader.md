# Custom Loader

Built-in loaders are:

- `matter`: parse frontmatter and provide content and data (`.md`, `.mdx`)
- `json`: parse document as json (`.json`)
- `yaml`: parse document as yaml (`.yaml`, `.yml`)

Velite supports custom loaders. A loader is an object with a `match` property (file extensions or a matcher function) and a synchronous `load` method that receives a `LoaderInput` and returns a `LoaderResult`.

::: warning

In the current 1.0 alpha, custom loaders cannot be registered from the config file — there is no `loaders` field on `defineConfig` and no per-collection `loader` option. The `Loader` / `defineLoader` exports describe the contract; registration is available only through the programmatic builder composition, which is not public API yet. Config-file registration is planned for a future release.

:::

```js
import toml from 'toml'
import { defineLoader } from 'velite'

export const tomlLoader = defineLoader({
  match: ['.toml'],
  load: input => {
    const data = toml.parse(input.text)
    return { items: [{ key: 0, data }] }
  }
})
```

## Loader Interface

```ts
interface Loader {
  /** File extensions or a custom matcher function. */
  match: string[] | ((path: string) => boolean)
  /** Load file content into structured items. Synchronous. */
  load(input: LoaderInput): LoaderResult
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

## Precedence

When multiple loaders could match a path, the first match wins. Custom loaders are consulted before the built-ins, so a custom loader with `match: ['.json']` replaces the built-in JSON parser for that path.
