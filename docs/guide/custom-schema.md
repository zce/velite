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

import type { Image } from 'velite'

/**
 * Remote Image with metadata schema
 */
export const remoteImage = () =>
  s.string().transform<Image>(async (value, { addIssue }) => {
    try {
      const response = await fetch(value)
      const blob = await response.blob()
      const buffer = await blob.arrayBuffer()
      const metadata = await getImageMetadata(Buffer.from(buffer))
      if (metadata == null) throw new Error(`Failed to get image metadata: ${value}`)
      return { src: value, ...metadata }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      addIssue({ fatal: true, code: 'custom', message })
      return null as never
    }
  })
```

## Schema Context

> [!TIP]
> Custom schemas often need to read the current file or resolved config. For new schemas, use `context()` to access this parser context.

```ts
import { context, defineSchema, s } from 'velite'

// convert a nonexistent field
export const path = defineSchema(() =>
  s.custom<string | undefined>().transform(value => {
    if (value != null) return value
    return context().file.path
  })
)
```

`context()` must be called while Velite is parsing a schema, such as inside `.transform()`, `.refine()`, or `.superRefine()`. It returns the current parser context:

```ts
interface ParserContext {
  readonly config: Config
  readonly file: VeliteFile
}
```

The previous schema callback `meta` value is still supported for compatibility:

```ts
import { defineSchema, s } from 'velite'

export const path = defineSchema(() =>
  s.custom<string | undefined>().transform((value, { meta }) => {
    if (value != null) return value
    return meta.path
  })
)
```

Prefer `context()` for new custom schemas. It keeps file/config access explicit and avoids relying on Velite's extended Zod callback metadata.

### Reference

The type of `context().file` is [`VeliteFile`](../reference/types.md#velitefile). The type of the compatibility `meta` value is `ZodMeta`, which extends `VeliteFile`.
