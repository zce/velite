import * as db from '#site/content'

export default async function Home() {
  const posts = await db.posts()
  return (
    <div>
      <h1>Home</h1>
      <ul>
        {posts.map(post => (
          <li key={post.slug}>
            <a href={`/${post.slug}`}>{post.title}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}
