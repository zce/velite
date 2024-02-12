# Using Collections in Your Apps

Velite builds your contents into JSON file, and generates type inference for TypeScript, and you can use the output data in your application with confidence.

## Output Structure

```diff
 root
+├── .velite
+│   ├── posts.json                  # posts collection output
+│   └── others.json                 # others collection output
 ├── content
 │   ├── posts
 │   │   ├── hello-world.md
 │   │   └── hello-world-2.md
 │   └── others
 ├── public
+│   └── static
+│       ├── cover-2a4138dh.jpg      # from frontmatter reference
+│       ├── img-2hd8f3sd.jpg        # from content reference
+│       ├── plain-37d62h1s.txt      # from content reference
+│       └── video-72hhd9f.mp4       # from frontmatter reference
 ├── package.json
 └── velite.config.js
```

in `.velite` directory, Velite generates the output files for each collection, and the `index.js` and `index.d.ts` for your application to use.

::: code-group

```js [index.js]
export { default as posts } from './posts.json'
export { default as others } from './others.json'
```

```js [index.d.ts]
import config from '../velite.config'

type Collections = typeof config.collections

export type Post = Collections['posts']['schema']['_output']
export declare const posts: Post[]

export type Other = Collections['others']['schema']['_output']
export declare const others: Other[]
```

```json [posts.json]
[
  {
    "title": "Hello world",
    "slug": "hello-world",
    "date": "1992-02-25T13:22:00.000Z",
    "cover": {
      "src": "/static/cover-2a4138dh.jpg",
      "height": 1100,
      "width": 1650,
      "blurDataURL": "data:image/webp;base64,UklGRjwAAABXRUJQVlA4IDAAAACwAQCdASoIAAUADMDOJbACdADWaUXAAMltC0BZxTv24bHUX8EibgVs/sPiTqq6QAA=",
      "blurWidth": 8,
      "blurHeight": 5
    },
    "video": "/static/video-72hhd9f.mp4",
    "metadata": {
      "readingTime": 1,
      "wordCount": 1
    },
    "excerpt": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse",
    "content": "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse</p>\n<p><img src=\"/static/img-2hd8f3sd.jpg\" alt=\"some image\" /></p>\n<p><a href=\"/static/plain-37d62h1s.txt\">link to file</a></p>\n",
    "permalink": "/blog/hello-world"
  }
]
```

```json [others.json]
[
  ...
]
```

:::

::: tip

If you're using Git for version control, we recommend ignoring the `.velite` directory by adding `.velite` to your `.gitignore`. This tells Git to ignore this directory and any files inside of it.

```sh
echo '\n.velite' >> .gitignore
```

:::

## Use in Your Project

Here is a Next.js example of using the output in your project.

```tsx [app/posts/[slug]/page.tsx]
import { notFound } from 'next/navigation'

import { posts } from './.velite'

interface PostProps {
  params: {
    slug: string
  }
}

function getPostBySlug(slug: string) {
  return posts.find(post => post.slug === slug)
}

export default function PostPage({ params }: PostProps) {
  const post = getPostBySlug(params.slug)
  if (post == null) notFound()
  return (
    <article className="prose dark:prose-invert py-6">
      <h1 className="mb-2">{post.title}</h1>
      {post.description && <p className="mt-0 text-xl text-slate-700 dark:text-slate-200">{post.description}</p>}
      <hr className="my-4" />
      <div className="prose" dangerouslySetInnerHTML={{ __html: post.content }}></div>
    </article>
  )
}

export function generateMetadata({ params }: PostProps) {
  const post = getPostBySlug(params.slug)
  if (post == null) return {}
  return { title: post.title, description: post.description }
}

export function generateStaticParams() {
  return posts.map(({ slug }) => ({ slug }))
}
```

## Path Aliases

You can define path aliases in `tsconfig.json`:

```json [tsconfig.json]
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "#site/content": ["./.velite"]
    }
  }
}
```

then you can import the output file in your project:

```tsx [app/posts/[slug]/page.tsx]
import { posts } from '#site/content'

// ...
```
