# Anti Patterns

The following patterns are prohibited unless explicitly requested.

## IoC Containers

Avoid:

```ts
container.resolve(...)
container.get(...)
container.register(...)
```

---

## Service Locator

Avoid:

```ts
services.get('user')
globalContainer.get('db')
```

---

## Decorator Injection

Avoid:

```ts
@injectable()
@inject()
```

---

## Runtime Auto Registration

Avoid:

```ts
scanModules()
registerAll()
loadAllServices()
```

---

## Singleton Services

Avoid:

```ts
export const userService = createUserService(...)
```

Prefer creating services in the composition root.

---

## Dependency / Input Mixing

Avoid:

```ts
execute({
  db,
  logger,
  userId
})
```

Keep dependencies and business inputs separate.

---

## Context Abuse

Avoid:

```ts
ctx().db
ctx().logger
ctx().userModule
```

`ctx()` is metadata only.
