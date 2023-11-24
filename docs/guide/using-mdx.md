# MDX Support

~~To maintain simplicity and efficiency, Velite currently does not have built-in MDX support, but you can easily support it.~~

- [examples/next](https://github.com/zce/velite/tree/main/examples/mdx)

## MDX Content Component Example

~~Velite provides a built-in `MDXContent` component to render MDX content.~~

```jsx
import * as runtime from 'react/jsx-runtime'
import Image from 'next/image'

interface MdxProps {
  code: string
  components?: Record<string, React.ComponentType>
}

const useMDXComponent = (code: string) => {
  const fn = new Function(code)
  return fn({ ...runtime }).default
}

export function MDXContent({ code, components }: MdxProps) {
  const Component = useMDXComponent(code)
  return <Component components={{ Image, ...components }} />
}
```

```jsx
import { MDXContent } from './mdx-content'

export default function Post({ post }) {
  return (
    <article>
      <h1>{post.title}</h1>
      <MDXContent code={post.content} />
    </article>
  )
}
```
