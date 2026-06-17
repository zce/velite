# Last Modified Schema

You can create a custom schema to show the last modified time for your contents. This can be based on:

- File stat

- Git timestamp

## Based on file stat

Create a timestamp schema based on file stat.

```ts
import { stat } from 'fs/promises'
import { context, defineSchema, s } from 'velite'

const timestamp = defineSchema(() =>
  s
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async () => {
      const { file } = context()
      const stats = await stat(file.path)
      return stats.mtime.toISOString()
    })
)
```

Use it in your schema

```ts
const posts = defineCollection({
  // ...
  schema: {
    // ...
    lastModified: timestamp()
  }
})
```

## Based on git timestamp

```ts
import { exec } from 'child_process'
import { promisify } from 'util'
import { context, defineSchema, s } from 'velite'

const execAsync = promisify(exec)

const timestamp = defineSchema(() =>
  s
    .custom<string>(i => typeof i === 'string')
    .optional()
    .transform<string>(async () => {
      const { file } = context()
      const { stdout } = await execAsync(`git log -1 --format=%cd ${file.path}`)
      return new Date(stdout || Date.now()).toISOString()
    })
)
```

Use it in your schema

```ts
const posts = defineCollection({
  // ...
  schema: {
    // ...
    lastModified: timestamp()
  }
})
```
