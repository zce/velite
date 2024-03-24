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

## Options

| Option          | Description            |
| --------------- | ---------------------- |
| `-v, --version` | Print version number   |
| `-h, --help`    | Print help information |

## `velite build`

Build the contents with default config file in current directory.

### Usage

```sh
$ velite build [options]
```

### Options

| Option                | Description                                  | Default            |
| --------------------- | -------------------------------------------- | ------------------ |
| `-c, --config <path>` | Use specified config file                    | `velite.config.js` |
| `--clean`             | Clean output directory before build          | `false`            |
| `--watch`             | Watch for changes and rebuild                | `false`            |
| `--verbose`           | Print additional information                 | `false`            |
| `--silent`            | Silent mode (no output)                      | `false`            |
| `--strict`            | Terminate process on schema validation error | `false`            |
| `--debug`             | Output full error stack trace                | `false`            |

## `velite dev`

Build the contents with watch mode.

### Usage

```sh
$ velite dev [options]
```

### Options

| Option                | Description                                  | Default            |
| --------------------- | -------------------------------------------- | ------------------ |
| `-c, --config <path>` | Use specified config file                    | `velite.config.js` |
| `--clean`             | Clean output directory before build          | `false`            |
| `--verbose`           | Print additional information                 | `false`            |
| `--silent`            | Silent mode (no output)                      | `false`            |
| `--strict`            | Terminate process on schema validation error | `false`            |
| `--debug`             | Output full error stack trace                | `false`            |

## `velite init`

TODO: Create a default config file in current directory.

### Usage

```sh
$ velite init [options]
```
