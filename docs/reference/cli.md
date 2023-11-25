# CLI Reference

## Usage

::: code-group

```sh [npm]
$ npx velite <command> [options]
```

```sh [pnpm]
$ pnpm velite <command> [options]
```

```sh [yarn]
$ yarn velite <command> [options]
```

```sh [bun]
$ bun velite <command> [options]
```

:::

## `velite build`

Build the contents with default config file in current directory.

### Usage

```sh
$ velite build [options]
```

### Options

| Option                | Description                                             | Default            |
| --------------------- | ------------------------------------------------------- | ------------------ |
| `-c, --config <path>` | Use specified config file                               | `velite.config.js` |
| `--clean`             | Clean output directory before build                     | `false`            |
| `--watch`             | Watch for changes and rebuild                           | `false`            |
| `--verbose`           | Print additional information                            | `false`            |
| `--debug`             | Print complete error stack when error occurs (CLI only) | `false`            |
| `-v, --version`       | Print version number                                    |                    |
| `-h, --help`          | Print help information                                  |                    |

## `velite init`

TODO: Create a default config file in current directory.

### Usage

```sh
$ velite init [options]
```
