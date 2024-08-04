# Last Modified Schema

We provide a last modified timestamp schema based on file stat and git timestamp.

## Based on file stat

create a timestamp schema based on file stat.

```ts
const timestamp = () =>
  s.custom<string | undefined>(i => i === undefined || typeof i === 'string').transform<string>(async (value, { meta, addIssue }) => {
    if (value != null) {
      addIssue({ fatal: false, code: 'custom', message: '`s.timestamp()` schema will resolve the file modified timestamp' })
    }

    const stats = await stat(meta.path)
    return stats.mtime.toISOString()
  })
```

use it in your schema

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
const execAsync = promisify(exec)

const timestamp = () =>
  s.custom<string | undefined>(i => i === undefined || typeof i === 'string').transform<string>(async (value, { meta, addIssue }) => {
    if (value != null) {
      addIssue({ fatal: false, code: 'custom', message: '`s.timestamp()` schema will resolve the value from `git log -1 --format=%cd`' })
    }
    const { stdout } = await execAsync(`git log -1 --format=%cd ${meta.path}`)
    return new Date(stdout).toISOString()
  })
```

use it in your schema

```ts
const posts = defineCollection({
  // ...
  schema: {
    // ...
    lastModified: timestamp()
  }
})
```
