<div align="center">
  <a href="https://velite.js.org">
    <picture>
      <source srcset="https://velite.js.org/assets/logo-dark.svg" media="(prefers-color-scheme: dark)">
      <img src="https://velite.js.org/assets/logo.svg" width="300 alt="Velite" title="Velite">
    </picture>
  </a>
  <p>Turns Markdown, YAML, JSON, or other files into app's data layer with typesafe schema.</p>
  <p>
    <a href="https://github.com/zce/velite/actions"><img src="https://img.shields.io/github/actions/workflow/status/zce/velite/main.yml" alt="Build Status"></a>
    <a href="https://github.com/zce/velite/blob/master/LICENSE"><img src="https://img.shields.io/github/license/zce/velite" alt="License"></a>
    <a href="https://npm.im/velite"><img src="https://img.shields.io/npm/v/velite" alt="NPM Version"></a>
    <a href="https://npm.im/velite"><img src="https://img.shields.io/node/v/velite" alt="Node Version"></a>
    <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen" alt="Code Style"></a>
    <br>
    <a href="https://npm.im/velite"><img src="https://img.shields.io/npm/dm/velite" alt="NPM Downloads"></a>
    <a href="https://packagephobia.com/result?p=velite"><img src="https://packagephobia.com/badge?p=velite" alt="Install Size"></a>
    <a href="https://github.com/zce/velite"><img src="https://img.shields.io/github/repo-size/zce/velite" alt="Repo Size"></a>
    <a href="https://github.com/zce/velite"><img src="https://img.shields.io/librariesio/release/npm/velite" alt="Dependencies Status"></a>
  </p>
</div>

🚧 🚧 🚧 the [documentation](https://velite.js.org) is not yet complete currently. but the functionality is mostly stable, although there is still a possibility of significant changes being made.

However, I have provided some [examples](https://github.com/zce/velite/tree/main/examples) for your consideration.

## Introduction

Velite is a tool for building type-safe content layers for applications, turn Markdown, YAML, JSON, or other files into app's data layer with Zod schema.

Inspired by [Contentlayer](https://contentlayer.dev), based on [Zod](https://zod.dev) and [Unified](https://unifiedjs.com), and powered by [ESBuild](https://esbuild.github.io).

<picture>
  <source srcset="https://velite.js.org/assets/flow-dark.svg" media="(prefers-color-scheme: dark)">
  <img src="https://velite.js.org/assets/flow.svg" alt="Velite Workflow" title="Velite Workflow">
</picture>

### Naming Origin

"Velite" comes from the English word "elite".

> "Velite" itself is the code name for Napoleon's elite army.

## Key Features

- **Easy to use**: Move your contents into `content` folder, define collections config, run `velite` command, and get the data layer.
- **Type-safe**: Contents schema validation by [Zod](https://zod.dev), and type inference for TypeScript.
- **Framework Agnostic**: JSON & Entry & DTS output, out of the box support for React, Vue, Svelte, Solid, etc.
- **Light-weight**: Choose more native APIs instead of bloated NPM modules, less runtime dependencies, so it is fast and efficiently.
- **Still powerful**: Built-in Markdown, YAML, JSON support, relative files & images processing, schema validation, etc.
- **Configurable**: Both input and output directories can be customized, and support for custom loaders, hooks, etc.
- **Extensible**: Support any file types by custom loaders, Custom field validation and transform by custom schema, and any output formats by hooks

Check out our detailed [Why Velite](https://velite.js.org/guide/introduction#why-velite) to learn more about what makes Velite special. ✨

## Try Velite Online

You can try Velite directly in your browser on StackBlitz:

- https://stackblitz.com/edit/velite-basic
- https://stackblitz.com/edit/velite-nextjs

## Roadmap

The following are the features I want to achieve or are under development:

- [ ] Full documentation
- [ ] File \_raw output?
- [ ] Optimize the config structure, bundle & load
- [ ] More built-in schemas
- [ ] Assets OSS support
- [ ] Unit & E2E tests ?
- [ ] Scoffolding tool
- [ ] Next.js plugin
- [ ] Gatsby plugin
- [ ] More examples

See the [open issues](https://github.com/zce/velite/issues) for a list of proposed features (and known issues).

## Contributing

1. **Fork** it on GitHub!
2. **Clone** the fork to your own machine.
3. **Checkout** your feature branch: `git checkout -b my-awesome-feature`
4. **Commit** your changes to your own branch: `git commit -am 'Add some feature'`
5. **Push** your work back up to your fork: `git push -u origin my-awesome-feature`
6. Submit a **Pull Request** so that we can review your changes.

> **NOTE**: Be sure to merge the latest from "upstream" before making a pull request!

## License

[MIT](license) &copy; [zce](https://zce.me)
