# Configuration

When running vite from the command line, Vite will automatically try to resolve a config file named vite.config.js inside project root (other JS and TS extensions are also supported).

The most basic config file looks like this:

## Velite Config File

Velite uses `velite.config.js` as the config file. You can create it in the root directory of your project.

```js
// velite.config.js
module.exports = {
  // ...
}
```

::: tip
Config file supports TypeScript & ESM, so you can use the full power of TypeScript to write your config file.
:::

## Config Schema

The config file is a commonjs module that exports a function that returns a config object.

```js
// velite.config.js
module.exports = () => ({
  // ...
})
```

The config object is a plain object that contains the following properties:

- `contentDir`: The directory where the content files are located. Default to `content`.
- `outDir`: The directory where the built content files are located. Default to `.velite`.
- `schemas`: The schemas of the content files. Default to `{}`.

```js
// velite.config.js
module.exports = () => ({
  contentDir: 'content',
  outDir: '.velite',
  schemas: {
    posts: {
      // ...
    },
    others: {
      // ...
    }
  }
})
```
