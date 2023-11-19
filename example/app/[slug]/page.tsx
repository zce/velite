import * as db from '#site/content'

export default async function Post({ params: { slug } }: { params: { slug: string } }) {
  const posts = await db.posts()
  const post = posts.find(post => post.slug === slug)
  return (
    <div>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }}></div>
    </div>
  )
}
