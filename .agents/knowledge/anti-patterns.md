# Anti Patterns

The following patterns are prohibited unless explicitly requested.

## Dependency Injection Containers

Avoid:

```ts
container.resolve(...)
container.get(...)
container.register(...)
```

Reason:

- hidden dependencies
- difficult tracing
- runtime complexity

---

## Service Locator

Avoid:

```ts
services.user.getUser(...)
globalContainer.get(...)
```

Reason:

Dependencies become invisible.

---

## Singleton Modules

Avoid:

```ts
export const userService = createUserService(...)
```

Reason:

Harder testing and lifecycle control.

---

## Decorator-Based Injection

Avoid:

```ts
@injectable()
@inject()
```

Reason:

Requires runtime metadata and hidden wiring.

---

## Runtime Auto Registration

Avoid:

```ts
loadModules()
scanDirectory()
registerAllModules()
```

Reason:

Dependencies become implicit.

---

## Shared Utility Buckets

Avoid:

```text
common
shared
utils
helpers
misc
```

Reason:

They tend to accumulate unrelated responsibilities.

Prefer domain-oriented modules instead.

---

## Hidden Global State

Avoid:

```ts
globalThis.xxx
singleton.xxx
module-level mutable state
```

Unless the state is intentionally process-wide.

---

## Dependency Mixing

Avoid:

```ts
function execute({ db, logger, userId })
```

Reason:

Dependencies and business inputs have different lifecycles.

Keep them separate.
