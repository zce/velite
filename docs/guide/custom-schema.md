# Custom Schema

> Schema is the core of Velite. It defines the structure and type of your content and validates it.
>
> Refer to [Velite Schemas](velite-schemas.md) for more information about built-in schema.

Velite supports custom schema. A schema is a plain JavaScript function that returns a [Zod](https://zod.dev) schema object. There is no `defineSchema` helper — the factory function itself is the schema definition.

Generally, I divide the schema into two categories: one for data validation and the other for data transformation.

## Define a Validation Schema

```ts
import { s } from 'velite'

// `s` is extended from Zod with some custom schemas,
// `s` also includes all members of zod, so you can use `s` as `z`

// for validating title
export const title = () => s.string().min(1).max(100)

// for validating email
export const email = () => s.string().email({ message: 'Invalid email address' })

// custom validation logic
export const hello = () =>
  s.string().refine(value => {
    if (value !== 'hello') {
      return 'Value must be "hello"'
    }
    return true
  })
```

Refer to [Zod documentation](https://zod.dev) for more information about Zod.

## Define a Transformation Schema

```ts
import { s } from 'velite'

// for transforming title
export const title = () => s.string().transform(value => value.toUpperCase())

// ...
```

When you need an explicit output type, use the `VeliteSchema` helper type:

```ts
import { s } from 'velite'

import type { VeliteSchema } from 'velite'

export const readingTime = (): VeliteSchema<number> => s.string().transform(value => computeReadingTime(value))
```

### Example

#### Remote Image with BlurDataURL Schema

```ts
import { s } from 'velite'

import type { ImageData } from 'velite'

/**
 * Remote Image with metadata schema.
 *
 * `getImageMetadata` is an internal helper; for remote images you can call
 * your own metadata extractor and shape the result into `ImageData`.
 */
export const remoteImage = () =>
  s.string().transform<ImageData>(async (value, ctx) => {
    try {
      const response = await fetch(value)
      const blob = await response.blob()
      const buffer = Buffer.from(await blob.arrayBuffer())
      const metadata = await extractMetadata(buffer)
      if (metadata == null) throw new Error(`Failed to get image metadata: ${value}`)
      return { src: value, ...metadata }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.addIssue({ fatal: true, code: 'custom', message })
      return null as never
    }
  })
```

## Schema Context

> [!TIP]
> Custom schemas often need to read the current file or project info. Use `context()` to access the current schema context.

```ts
import { context, s } from 'velite'

// derive a field from the current file path
export const path = () =>
  s
    .string()
    .optional()
    .transform(value => {
      if (value != null) return value
      return context().file.path
    })
```

`context()` must be called while Velite is parsing a schema, such as inside `.transform()`, `.refine()`, or `.superRefine()`. It returns the current schema context:

```ts
interface SchemaContext {
  readonly project: ProjectInfo
  readonly file: ContentFile
  readonly record: ContentRecord
  readonly store: SessionStore
}
```

`SessionStore` is an advanced, session-scoped store for sharing state across records within the same build or watch session. It only exposes `get`, `has` and `getOrCreate` — there is no `set()`, so concurrent schema validation stays deterministic:

```ts
const key = Symbol('my-schema.state')

export const counted = () =>
  s.string().transform(value => {
    const state = context().store.getOrCreate(key, () => ({ count: 0 }))
    state.count += 1
    return value
  })
```

When a custom schema derives a missing object field from `context()`, make the schema optional before the transform. Zod 4 only sends missing object keys into transforms when the field schema is optional:

```ts
export const rawBody = () =>
  s
    .custom<string>(value => typeof value === 'string')
    .optional()
    .transform(value => value ?? context().file.content ?? '')
```

Built-in file-derived schemas such as `s.path()`, `s.raw()`, `s.markdown()`, `s.mdx()`, `s.excerpt()`, `s.metadata()`, and `s.toc()` include this optional wrapper. Value-required schemas such as `s.file()`, `s.image()`, `s.slug()`, `s.unique()`, and `s.isoDate()` do not.

### Error Handling in Transforms

In Zod 4, schema callbacks receive a context object that provides `addIssue()` for reporting validation errors.

```ts
import { s } from 'velite'

export const safeTransform = () =>
  s.string().transform(async (value, ctx) => {
    try {
      const result = await processValue(value)
      return result
    } catch (err) {
      ctx.addIssue({
        fatal: true,
        code: 'custom',
        message: err instanceof Error ? err.message : String(err)
      })
      return null as never
    }
  })
```

### Reference

- `context()` returns `{ project: ProjectInfo, file: ContentFile, record: ContentRecord, store: SessionStore }`.
- `ctx.addIssue()` accepts `{ fatal?: boolean, code: string, message: string }`.
- See [`ContentFile`](../reference/types.md#contentfile) for file metadata structure.
- See [Lifecycle](./lifecycle.md) for schema context and session store lifetime details.
