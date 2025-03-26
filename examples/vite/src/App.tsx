import { posts } from '#velite'

export default function App() {
  return (
    <>
      {posts.map(post => (
        <div key={post.slug}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </div>
      ))}
    </>
  )
}
