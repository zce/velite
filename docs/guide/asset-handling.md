# Asset Handling

## Refer

- [File Schema](velite-schemas.md#s-file-options)
- [Image Schema](velite-schemas.md#s-image-options)
- [Markdown Definition](velite-schemas.md#content-markdown-options)
- [MDX Definition](velite-schemas.md#content-mdx-options)

Content Definitions resolve linked assets during Transform when `copyLinkedFiles` is enabled. TOC-only requests still perform this work even though they skip serialization/minification; source-only excerpt/metadata requests do not run returned transformers. See [controlled effects](content-executions.md#detached-values-and-controlled-effects) for stage/record eligibility and the limits of plugin I/O rollback.

## Uploading Assets

To serve assets from an external origin, point `output.base` at it — every generated asset URL (from `s.file`, `s.image`, and copied linked files) is prefixed with `output.base`:

```ts
import { defineConfig } from 'velite'

export default defineConfig({
  output: {
    base: 'https://oss.your.com/static/'
  }
})
```

The files themselves are still written to the local `output.assets` directory. Velite does not currently ship a post-build upload hook; if you need to push the emitted `output.assets` directory to OSS/CDN, wrap the build in your own script (run `velite build`, then upload the directory) — or consume the build programmatically via the [Node API](../reference/api.md) and upload in your own code after it resolves.
