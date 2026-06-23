# Architecture Rules

## Core Position

Use explicit dependency injection through factory functions.

Do not introduce a dependency injection framework, IoC container, service locator, decorator-based injection system, reflection-based injection, or runtime dependency registry unless explicitly requested.

The default module shape is:

```ts
createXxxModule(deps)
```

Dependencies must be visible, typed, and easy to replace in tests.

---

## Mandatory Rules

### 1. Factory DI First

All business modules must be created through factory functions.

Correct:

```ts
const userModule = createUserModule({
  db,
  logger
})
```

Incorrect:

```ts
const userModule = container.resolve(UserModule)
```

---

### 2. Composition Root

Concrete dependency wiring must happen in a dedicated composition root.

Modules must not create their own infrastructure dependencies unless they own them directly.

---

### 3. Runtime Independence

Prefer patterns that work across:

- Node.js
- Bun
- Deno
- Browser
- Edge Runtime
- CLI
- Serverless

Avoid runtime-specific architecture unless isolated behind an adapter.

---

### 4. Explicit Over Magic

Prefer:

- explicit imports
- explicit dependencies
- explicit construction
- static typing

Avoid:

- runtime scanning
- automatic registration
- decorators
- reflection
- hidden global containers

---

## Allowed Exception

`ctx()` is allowed as a controlled runtime context getter.

It must only expose execution-scoped metadata, not services.
