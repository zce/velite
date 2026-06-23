# Runtime Context Pattern

## Purpose

`ctx()` is a controlled global getter for execution-scoped metadata.

It is an exception to factory DI.

It exists to avoid passing request identity and tracing metadata through every function manually.

---

## Allowed Values

`ctx()` may contain:

- requestId
- traceId
- tenantId
- userId
- locale
- timezone
- auth/session claims
- feature flag snapshot

---

## Forbidden Values

`ctx()` must not contain:

- db
- logger
- repositories
- service modules
- API clients
- config
- queues
- caches
- business dependencies

---

## Rule

Use factory DI for capabilities.

Use `ctx()` only for current execution identity and metadata.

Correct:

```ts
const { tenantId, userId } = ctx()
```

Incorrect:

```ts
const db = ctx().db
const userModule = ctx().userModule
```

---

## Behavior

`ctx()` must fail fast when called outside a bound execution context.

Use `tryCtx()` only when absence of context is valid.
