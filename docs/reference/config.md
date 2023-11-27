# Configuration

When running `velite` from the command line, Velite will automatically try to resolve a config file named `velite.config.js` inside project root (other JS and TS extensions are also supported).

## Velite Config File

Velite uses `velite.config.js` as the config file. You can create it in the root directory of your project.

```js
// velite.config.js
export default {
  // ...
}
```

::: tip
Config file supports TypeScript & ESM & CommonJS. you can use the full power of TypeScript to write your config file, and it's recommended strongly.
:::

## Typed Config

For the better experience, Velite provides a `defineConfig` identity function to define the config file type.

```js
import { defineConfig } from 'velite'

export default defineConfig({
  // ...
})
```

In addition, Velite also provides a `UserConfig` type to describe the config file type.

```ts
import type { UserConfig } from 'velite'

const config: UserConfig = {
  // ...
}

export default config
```

::: tip

Recommended to use `defineConfig` identity function to define the config file type, because it can provide better type inference.

:::

And other identity functions to help you define the config file type:

- `defineCollection`: define collection options
- `defineLoader`: define a file loader

## Config Options

The config object is a plain object that contains the following properties:

```ts
interface UserConfig<C extends Collections = Collections> {
  /**
   * resolved config file path
   */
  configPath: string
  /**
   * The root directory of the contents
   * @default 'content'
   */
  root: string
  /**
   * Output configuration
   */
  output: {
    /**
     * The output directory of the data
     * @default '.velite'
     */
    data: string
    /**
     * The output directory of the static assets,
     * should be served statically by the app
     * @default 'public'
     */
    static: string
    /**
     * The public base path of the static files.
     * Must include one level of directory, otherwise `--clean` will automatically clear the static root dir,
     * this means that other files in the static dir will also be cleared together
     * @default '/static/[name]-[hash:8].[ext]'
     */
    filename: `/${string}/${string}`
    /**
     * The ext blacklist of the static files, such as ['md', 'yml']
     * @default []
     */
    ignoreFileExtensions: string[]
    /**
     * Whether to clean the output directories before build
     * @default false
     */
    clean: boolean
  }
  /**
   * Collections
   */
  collections: C
  /**
   * File loaders
   * @default [] (built-in loaders: 'json', 'yaml', 'markdown')
   */
  loaders: Loader[]
  /**
   * Global markdown options
   */
  markdown: MarkdownOptions
  /**
   * Global MDX options
   */
  mdx: MdxOptions
  /**
   * Data prepare hook, before write to file
   * @description
   * You can apply additional processing to the output data, such as modify them, add missing data, handle relationships, or write them to files.
   * return false to prevent the default output to a file if you wanted
   */
  prepare?: (data: {
    [name in keyof C]: C[name]['single'] extends true ? C[name]['schema']['_output'] : Array<C[name]['schema']['_output']>
  }) => Promisable<void | false>
  /**
   * Build success hook
   * @description
   * You can do anything after the build is complete, such as print some tips or deploy the output files.
   */
  complete?: () => Promisable<void>
}
```

<!-- ### `root`

- Type: `string`
- Default: `'content'`

The directory where the content files are located.

### `output`

- Type: `object`
- Default: `{ dir: '.velite' }` -->
