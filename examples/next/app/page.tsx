import Link from 'next/link'

import * as db from '#site/content'

export default async function Home() {
  const posts = await db.posts()
  return (
    <div className="prose dark:prose-invert">
      {posts.map(post => (
        <article key={post.slug}>
          <Link href={`/posts/${post.slug}`}>
            <h2>{post.title}</h2>
          </Link>
          <p>{post.summary}</p>
        </article>
      ))}
    </div>
  )
}
