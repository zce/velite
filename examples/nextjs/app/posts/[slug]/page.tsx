import Image from 'next/image'
import { notFound } from 'next/navigation'

import { posts } from '#site/content'

interface PostProps {
  params: Promise<{ slug: string }>
}

function getPostBySlug(slug: string) {
  return posts.find(post => post.slug === slug)
}

export default async function PostPage({ params }: PostProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (post == null) notFound()

  return (
    <article className="prose lg:prose-lg dark:prose-invert py-6">
      <h1 className="mb-2">{post.title}</h1>
      {post.description && <p className="mt-0 text-xl text-slate-700 dark:text-slate-200">{post.description}</p>}
      {post.cover && <Image src={post.cover} alt={post.title} placeholder="blur" />}
      <hr className="my-4" />
      <div className="prose" dangerouslySetInnerHTML={{ __html: post.content }}></div>
    </article>
  )
}

export async function generateMetadata({ params }: PostProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (post == null) return {}
  return { title: post.title, description: post.description }
}

export function generateStaticParams() {
  return posts.map(post => ({ slug: post.slug }))
}
