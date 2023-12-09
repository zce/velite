import Link from 'next/link'

import { getPosts } from '#site/content'

export default async function Home() {
  const posts = await getPosts()
  return (
    <div className="prose dark:prose-invert">
      {posts.map(post => (
        <article key={post.slug} className={post.featured ? 'bg-slate-300' : ''}>
          <Link href={`/posts/${post.slug}`}>
            <h2>{post.title}</h2>
          </Link>
          <p>{post.excerpt}</p>
          <p>{post.tags.join(', ')}</p>
        </article>
      ))}
    </div>
  )
}
