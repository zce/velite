# Custom Schema

> Schema is the core of Velite. It defines the structure and type of your content and validates it.
>
> Refer to [Velite Schemas](velite-schemas.md) for more information about built-in schema.

Velite supports custom schema. A schema is a JavaScript function that returns a [Zod](https://zod.dev) schema object.

Generally, I divide the schema into two categories: one for data validation and the other for data transformation.

## Define a Validation Schema

```ts
import { defineSchema, s } from 'velite'

// `s` is extended from Zod with some custom schemas,
// `s` also includes all members of zod, so you can use `s` as `z`

// for validating title
export const title = defineSchema(() => s.string().min(1).max(100))

// for validating email
export const email = defineSchema(() => s.string().email({ message: 'Invalid email address' }))

// custom validation logic
export const hello = defineSchema(() =>
  s.string().refine(value => {
    if (value !== 'hello') {
      return 'Value must be "hello"'
    }
    return true
  })
)
```

Refer to [Zod documentation](https://zod.dev) for more information about Zod.

## Define a Transformation Schema

```ts
import { defineSchema, s } from 'velite'

// for transforming title
export const title = defineSchema(() => s.string().transform(value => value.toUpperCase()))

// ...
```

### Example

#### Remote Image with BlurDataURL Schema

```ts
import { getImageMetadata, s } from 'velite'

import type { VeliteImage } from 'velite'

/**
 * Remote Image with metadata schema
 */
export const remoteImage = () =>
  s.string().transform<VeliteImage>(async (value, ctx) => {
    try {
      const response = await fetch(value)
      const blob = await response.blob()
      const buffer = await blob.arrayBuffer()
      const metadata = await getImageMetadata(Buffer.from(buffer))
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
> Custom schemas often need to read the current file or resolved config. Use `context()` to access the current build context.

```ts
import { context, defineSchema, s } from 'velite'

// convert a nonexistent field
export const path = defineSchema(() =>
  s
    .string()
    .optional()
    .transform(value => {
      if (value != null) return value
      return context().file.path
    })
)
```

`context()` must be called while Velite is parsing a schema, such as inside `.transform()`, `.refine()`, or `.superRefine()`. It returns the current build context:

```ts
interface BuildContext {
  readonly config: ResolvedConfig
  readonly file: ContentFile
  readonly store: BuildStore
}
```

`BuildStore` is an advanced API for sharing state within the current build or watch rebuild:

```ts
const key = Symbol('my-schema.state')

export const counted = defineSchema(() =>
  s.string().transform(value => {
    const state = context().store.getOrCreate(key, () => ({ count: 0 }))
    state.count += 1
    return value
  })
)
```

When a custom schema derives a missing object field from `context()`, make the schema optional before the transform. Zod 4 only sends missing object keys into transforms when the field schema is optional:

```ts
export const rawBody = defineSchema(() =>
  s
    .custom<string>(value => typeof value === 'string')
    .optional()
    .transform(value => value ?? context().file.content ?? '')
)
```

Built-in file-derived schemas such as `s.path()`, `s.raw()`, `s.markdown()`, `s.mdx()`, `s.excerpt()`, `s.metadata()`, and `s.toc()` include this optional wrapper. Value-required schemas such as `s.file()`, `s.image()`, `s.slug()`, `s.unique()`, and `s.isodate()` do not.

### Error Handling in Transforms

In Zod 4, schema callbacks receive a context object that provides `addIssue()` for reporting validation errors.

```ts
import { defineSchema, s } from 'velite'

export const safeTransform = defineSchema(() =>
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
)
```

### Reference

- `context()` returns `{ config: ResolvedConfig, file: ContentFile, store: BuildStore }`.
- `ctx.addIssue()` accepts `{ fatal?: boolean, code: string, message: string }`.
- See [`ContentFile`](../reference/types.md#contentfile) for file metadata structure.
- See [Lifecycle](./lifecycle.md) for build context and store lifetime details.
