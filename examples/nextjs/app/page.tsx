import Link from 'next/link'

import * as db from '#site/content'

export default async function Home() {
  const posts = await db.posts()
  return (
    <div className="prose dark:prose-invert">
      {posts.map(post => (
        <article key={post.slug} className={post.featured ? 'bg-slate-300' : ''}>
          <Link href={`/posts/${post.slug}`}>
            <h2>{post.title}</h2>
          </Link>
          <p>{post.summary}</p>
          <p>{post.tags.join(', ')}</p>
        </article>
      ))}
    </div>
  )
}
