# Module Pattern

Velite uses explicit factory dependency injection for modules that own dependencies, lifecycle, state, or replaceable capabilities.

This is a hard rule for source architecture, but it is not a rule that every `.ts` file must be a factory.

## Canonical helper shape

Use this shape when adding a shared helper for module factories:

```ts
export type ModuleFactory<TDeps, TModule> = (deps: TDeps) => TModule

export type InferModule<TFactory> = TFactory extends (...args: never[]) => infer TModule ? TModule : never

export type InferDeps<TFactory> = TFactory extends (deps: infer TDeps) => unknown ? TDeps : never

export const defineModule = <TFactory extends ModuleFactory<any, any>>(factory: TFactory): TFactory => factory
```

`defineModule()` must preserve the exact factory type passed to it. Do not widen the result to a generic `(deps) => module` shape if that loses useful inference.

## Required factory modules

Use `createXxxModule(deps)` or `defineModule(deps => module)` for modules that are any of the following:

- Dependency-bearing: uses filesystem, logger, image processor, module loader, watcher, config loader, network client, clock, random source, or other replaceable capability.
- Stateful: owns cache, manifest, engine state, scheduler state, watcher state, locks, mutable session state, or lifecycle handles.
- Lifecycle-managed: needs `dispose()`, `close()`, `clean()`, subscription teardown, or explicit initialization.
- Composition-oriented: wires multiple lower-level modules into a larger API.
- Runtime adapter: binds platform-specific implementations to runtime interfaces.

Dependencies must be visible and typed at the factory boundary. Do not create infrastructure dependencies inside a business module unless that module directly owns them.

## Composition roots

Concrete wiring belongs in a composition root.

Good examples:

- Public entry facades that assemble a runtime and call a builder factory.
- Runtime adapter modules that assemble platform capabilities.
- Builder or pipeline factories that compose smaller derivations or services from explicit inputs.

Composition roots may create default instances for public convenience, but the underlying capability should still be replaceable in tests.

## Allowed direct exports

Do not wrap these in factories unless they later gain dependencies, lifecycle state, or a replaceable capability boundary:

- Pure functions and deterministic utilities.
- Type-only modules, interfaces, and type aliases.
- Constants, symbols, and input keys.
- Error classes and assertion helpers.
- Schema builders, schema namespaces, and identity helpers such as `defineConfig` or `defineCollection`.
- Public facade functions that delegate to an internal composition root.

## Dependency and input separation

Keep construction dependencies separate from operation inputs.

Prefer:

```ts
const users = createUserModule({ db, logger })
await users.getUser({ userId })
```

Avoid:

```ts
await getUser({ db, logger, userId })
```

Dependencies and business inputs have different lifecycles and should not share the same parameter object.

## Anti-patterns

Detailed prohibited patterns live in `.agents/knowledge/anti-patterns.md`. In short: no IoC containers, service locators, decorator injection, runtime auto-registration, hidden global services, or broad utility buckets unless explicitly requested.
