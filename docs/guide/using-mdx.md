# MDX Support

- [examples/nextjs](https://github.com/zce/velite/tree/main/examples/nextjs)

## MDX Content Component Example

`./components/mdx-content.tsx`:

```jsx
import * as runtime from 'react/jsx-runtime'
import Image from 'next/image'

const mdxComponents = {
  Image
}

const useMDXComponent = (code: string) => {
  const fn = new Function(code)
  return fn({ ...runtime }).default
}

interface MdxProps {
  code: string
  components?: Record<string, React.ComponentType>
}

export const MDXContent = ({ code, components }: MdxProps) => {
  const Component = useMDXComponent(code)
  return <Component components={{ ...mdxComponents, ...components }} />
}
```

`./pages/posts/[slug].tsx`:

```jsx
import { posts } from '@/.velite'
import { MDXContent } from '@/components/mdx-content'

export default function Post({ params: { slug } }) {
  const post = posts.find(i => i.slug === slug)
  return (
    <article>
      <h1>{post.title}</h1>
      <MDXContent code={post.content} />
    </article>
  )
}
```
