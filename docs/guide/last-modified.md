# Last Modified Schema

You can create a custom schema to show the last modified time for your contents. This can be based on:

- File stat

- Git timestamp

## Based on file stat

Create a timestamp schema based on file stat.

```ts
import { stat } from 'fs/promises'
import { defineSchema } from 'velite'

const timestamp = defineSchema(() =>
  s
    .custom<string | undefined>(i => i === undefined || typeof i === 'string')
    .transform<string>(async (value, { meta, addIssue }) => {
      if (value != null) {
        addIssue({ fatal: false, code: 'custom', message: '`s.timestamp()` schema will resolve the file modified timestamp' })
      }

      const stats = await stat(meta.path)
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
import { defineSchema } from 'velite'

const execAsync = promisify(exec)

const timestamp = defineSchema(() =>
  s
    .custom<string | undefined>(i => i === undefined || typeof i === 'string')
    .transform<string>(async (value, { meta, addIssue }) => {
      if (value != null) {
        addIssue({ fatal: false, code: 'custom', message: '`s.timestamp()` schema will resolve the value from `git log -1 --format=%cd`' })
      }
      const { stdout } = await execAsync(`git log -1 --format=%cd ${meta.path}`)
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
