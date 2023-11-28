# Custom Loader

built-in loaders are:

- `matter-loader`: parse frontmatter and provide content and data
- `json-loader`: parse document as json
- `yaml-loader`: parse document as yaml

Velite supports custom loaders. A loader is a function that takes a [vfile](https://github.com/vfile/vfile) as input and returns a JavaScript object.

In `velite.config.js`:

```js
import toml from 'toml'
import { defineConfig, defineLoader } from 'velite'

const tomlLoader = defineLoader({
  test: /\.toml$/,
  load: vfile => {
    return toml.parse(vfile.toString())
  }
})

export default defineConfig({
  // ...
  loaders: [tomlLoader]
})
```

This documentation is still being written. Please check back later.
