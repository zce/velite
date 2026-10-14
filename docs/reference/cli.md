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

Build the contents with default config file in current directory. Running `velite` without a command is equivalent to `velite build`.

### Usage

```sh
$ velite build [options]
```

### Options

| Option                | Description                                                                        | Default     |
| --------------------- | ---------------------------------------------------------------------------------- | ----------- |
| `-c, --config <path>` | Use specified config file (relative to cwd or absolute)                            | auto-detect |
| `--clean`             | Clean output directory before build                                                | `false`     |
| `--watch`             | Watch for changes and rebuild (same as `velite dev`)                               | `false`     |
| `--verbose`           | Print additional information                                                       | `false`     |
| `--silent`            | Silent mode (no output)                                                            | `false`     |
| `-s, --strict`        | Throw error and terminate process if the build produces any error-level diagnostic | `false`     |
| `--debug`             | Output full error stack trace                                                      | `false`     |

When `--config` is omitted, Velite searches `velite.config.ts`, `.js`, `.mjs`, `.mts`, `.cjs`, `.cts` (in that order) starting in the working directory and up to 3 parent directories.

## `velite dev`

Build the contents with watch mode.

### Usage

```sh
$ velite dev [options]
```

### Options

| Option                | Description                                                                        | Default     |
| --------------------- | ---------------------------------------------------------------------------------- | ----------- |
| `-c, --config <path>` | Use specified config file (relative to cwd or absolute)                            | auto-detect |
| `--clean`             | Clean output directory before build                                                | `false`     |
| `--watch`             | Watch for changes and rebuild (implied by `dev`)                                   | `true`      |
| `--verbose`           | Print additional information                                                       | `false`     |
| `--silent`            | Silent mode (no output)                                                            | `false`     |
| `-s, --strict`        | Throw error and terminate process if the build produces any error-level diagnostic | `false`     |
| `--debug`             | Output full error stack trace                                                      | `false`     |
