# Asset Handling

> [!TIP]
> This documentation is still being written. Please check back later.

## Refer

- [File Schema](velite-schemas.md#s-file)
- [Image Schema](velite-schemas.md#s-image)
- [Markdown Definition](velite-schemas.md#content-markdown-options)
- [MDX Definition](velite-schemas.md#content-mdx-options)

Content Definitions resolve linked assets during Transform when `copyLinkedFiles` is enabled. TOC-only requests still perform this work even though they skip serialization/minification; source-only excerpt/metadata requests do not run returned transformers. See [controlled effects](content-executions.md#detached-values-and-controlled-effects) for stage/record eligibility and the limits of plugin I/O rollback.

## Uploading Assets

You can upload assets to your OSS, CDN, or other storage services.

e.g. Upload images on complete hook:

```ts
import { defineConfig } from 'velite'

export default defineConfig({
  output: {
    base: 'https://oss.your.com/static/'
  },
  complete: async () => {
    // TODO: upload images
    // static => https://oss.your.com/static/
  }
})
```

Currently, we don't provide any built-in uploading plugins, we will provide them in the future.
