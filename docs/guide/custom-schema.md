# Custom Schema

> Schema is the core of Velite. It defines the structure and type of your content and validates it.
>
> refer to [Velite Schemas](velite-schemas.md) for more information about built-in schema.

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

refer to [Zod documentation](https://zod.dev) for more information about Zod.

## Define a Transformation Schema

```ts
import { defineSchema, s } from 'velite'

// for transforming title
export const title = defineSchema(() => s.string().transform(value => value.toUpperCase()))

// ...
```

## Schema Context

> [!TIP]
> Considering that Velite's scenario often needs to obtain metadata information about the current file in the schema, Velite does not use the original Zod package. Instead, it uses a custom Zod package that provides a `meta` member in the schema context.

```ts
import { defineSchema, s } from 'velite'

// convert a nonexistent field
export const path = defineSchema(() =>
  s.custom<string>().transform((value, ctx) => {
    if (ctx.meta.path) {
      return ctx.meta.path
    }
    return value
  })
)
```

### Reference

```ts
interface ZodMeta extends VeliteMeta {}

class VeliteMeta extends VFile {
  config: Config
  // raw file content body
  get content(): string | undefined
  // plain text content body
  get plain(): string | undefined
}
```
