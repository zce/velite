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

// custom validation logic using refine
export const hello = defineSchema(() => s.string().refine(value => value === 'hello', 'Value must be "hello"'))

// custom validation logic using superRefine (for more control)
export const customValidation = defineSchema(() =>
  s.string().superRefine((value, ctx) => {
    if (value.length < 5) {
      ctx.addIssue({ code: 'custom', message: 'Value must be at least 5 characters' })
    }
    if (!value.includes('@')) {
      ctx.addIssue({ code: 'custom', message: 'Value must contain @ symbol' })
    }
  })
)
```

Refer to [Zod documentation](https://zod.dev) for more information about Zod.

## Define a Transformation Schema

```ts
import { defineSchema, s } from 'velite'

// for transforming title (simple transform)
export const title = defineSchema(() => s.string().transform(value => value.toUpperCase()))

// for transforming with error handling (using ctx.addIssue)
export const safeTransform = defineSchema(() =>
  s.string().transform((value, ctx) => {
    try {
      return value.toUpperCase()
    } catch (err) {
      ctx.addIssue({ fatal: true, code: 'custom', message: 'Transform failed' })
      return value
    }
  })
)

// async transform (zod 4 supports async transforms)
export const asyncTransform = defineSchema(() =>
  s.string().transform(async (value, ctx) => {
    // async operations...
    return processedValue
  })
)
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
  s.string().transform<Image>(async (value, ctx) => {
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
> In Zod 4, the context object (`ctx`) in `refine`, `superRefine`, and `transform` provides an `addIssue()` method for adding validation errors. Velite extends this context to provide access to file metadata through `context()` function.

### Using Context API

```ts
import { context, defineSchema, s } from 'velite'

// Access file context in transform
export const path = defineSchema(() =>
  s.custom<string>().transform(value => {
    // Use context() to access current file information
    const { file, config } = context()

    if (value == null) {
      return file.path
    }
    return value
  })
)
```

### Context API Reference

The `context()` function returns an object with:

- `config`: The resolved Velite configuration
- `file`: The current [`VeliteFile`](../reference/types.md#velitefile) being processed

### Error Handling in Transforms

```ts
import { defineSchema, s } from 'velite'

export const safeTransform = defineSchema(() =>
  s.string().transform(async (value, ctx) => {
    try {
      // async operation
      const result = await processValue(value)
      return result
    } catch (err) {
      // Add error issue using Zod 4 API
      ctx.addIssue({
        fatal: true, // Set to true to stop processing
        code: 'custom', // Error code
        message: err.message // Error message
      })
      return null as never // Type assertion for TypeScript
    }
  })
)
```

### Reference

- `context()` returns `{ config: Config, file: VeliteFile }`
- `ctx.addIssue()` accepts `{ fatal?: boolean, code: string, message: string }`
- See [`VeliteFile`](../reference/types.md#velitefile) for file metadata structure
