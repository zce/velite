# Next.js + MDX + Velite

A template with Next.js 15 app dir, [Velite](https://github.com/zce/velite), Tailwind CSS and dark mode.

[MDX Example](content/pages/contact/index.mdx)

## Recipes

#### start Velite in npm script with `npm-run-all`:

**package.json**:

```json
{
  "scripts": {
    "dev:content": "velite --watch",
    "build:content": "velite --clean",
    "dev:next": "next dev",
    "build:next": "next build",
    "dev": "run-p dev:*",
    "build": "run-s build:*",
    "start": "next start"
  }
}
```
