<div align="center">
  <a href="https://velite.js.org">
    <picture>
      <source srcset="https://velite.js.org/assets/logo-dark.svg" media="(prefers-color-scheme: dark)">
      <img src="https://velite.js.org/assets/logo.svg" width="300 alt="Velite" title="Velite">
    </picture>
  </a>
  <p>Turns Markdown / MDX, YAML, JSON, or other files into app's data layer with type-safe schema.</p>
  <p>
    <a href="https://github.com/zce/velite/actions"><img src="https://img.shields.io/github/actions/workflow/status/zce/velite/main.yml" alt="Build Status"></a>
    <a href="https://github.com/zce/velite/blob/master/license"><img src="https://img.shields.io/github/license/zce/velite" alt="License"></a>
    <a href="https://npm.im/velite"><img src="https://img.shields.io/npm/v/velite" alt="NPM Version"></a>
    <a href="https://npm.im/velite"><img src="https://img.shields.io/node/v/velite" alt="Node Version"></a>
    <a href="https://standardjs.com"><img src="https://img.shields.io/badge/code_style-standard-brightgreen" alt="Code Style"></a>
    <br>
    <a href="https://npm.im/velite"><img src="https://img.shields.io/npm/dm/velite" alt="NPM Downloads"></a>
    <a href="https://packagephobia.com/result?p=velite"><img src="https://packagephobia.com/badge?p=velite" alt="Install Size"></a>
    <a href="https://github.com/zce/velite"><img src="https://img.shields.io/librariesio/release/npm/velite" alt="Dependencies Status"></a>
  </p>
</div>

## What is Velite?

Velite is a tool for building type-safe data layer, turns Markdown / MDX, YAML, JSON, or other files into app's data layer with Zod schema.

<picture>
  <source srcset="https://velite.js.org/assets/flow-dark.svg" media="(prefers-color-scheme: dark)">
  <img src="https://velite.js.org/assets/flow.svg" alt="Velite Workflow" title="Velite Workflow">
</picture>

### Naming Origin

"Velite" comes from the English word "elite".

> "Velite" itself is the code name for Napoleon's elite army.

## Key Features

- **Easy to use**: Move your contents into `content` folder, define collections schema, run `velite`, then use the output data in your application.
- **Type-safe**: Contents schema validation by [Zod](https://zod.dev), and generate type inference for TypeScript.
- **Framework Agnostic**: JSON & Entry & DTS output, out of the box support for any JavaScript framework or library.
- **Light-weight**: Choose more native APIs instead of bloated NPM modules, less runtime dependencies, so it is fast and efficiently.
- **Still powerful**: Built-in Markdown / MDX, YAML, JSON support, relative files & images processing, schema validation, etc.
- **Configurable**: Both input and output directories can be customized, and support for custom loaders, hooks, etc.
- **Extensible**: Support any file types by custom loaders, Custom field validation and transform by custom schema, and any output formats by hooks.

Check out our detailed [Why Velite](https://velite.js.org/guide/introduction#why-velite) to learn more about what makes Velite special. ✨

## Try Velite Online

You can try Velite directly in your browser on StackBlitz:

- https://stackblitz.com/edit/velite-basic
- https://stackblitz.com/edit/velite-nextjs

> [!NOTE]
> You may need a real-world project to start Velite quickly.
> I have forked the [shadcn-ui/taxonomy](https://tx.shadcn.com) project as an example, you can try it out.
> https://github.com/zce/taxonomy

## Who's using Velite?

- [Ark UI](https://github.com/chakra-ui/ark)
- [Chakra UI](https://github.com/chakra-ui/chakra-ui)
- [Park UI](https://github.com/cschroeter/park-ui)
- [etc.](https://github.com/zce/velite/network/dependents)

## Roadmap

The following are the features I want to achieve or are under development:

- [ ] More framework or build tool integration examples.
- [ ] More built-in schemas
- [ ] Unit & E2E tests?
- [ ] Scoffolding tool
- [ ] Incremental build
- [ ] Turborepo?
- [ ] Next.js plugin package? It's currently a [snippet](https://velite.js.org/guide/with-nextjs#start-velite-with-next-js-plugin).

See the [open issues](https://github.com/zce/velite/issues) for a list of proposed features (and known issues).

## Contributing

1. **Fork** it on GitHub!
2. **Clone** the fork to your own machine.
3. **Checkout** your feature branch: `git checkout -b my-awesome-feature`
4. **Commit** your changes to your own branch: `git commit -am 'Add some feature'`
5. **Push** your work back up to your fork: `git push -u origin my-awesome-feature`
6. Submit a **Pull Request** so that we can review your changes.

> [!NOTE]
> Be sure to merge the latest from "upstream" before making a pull request!

## License

[MIT](license) &copy; [zce](https://zce.me)
