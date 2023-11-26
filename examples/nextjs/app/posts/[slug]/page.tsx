import { notFound } from 'next/navigation'

import { getPosts } from '#site/content'

import type { Metadata } from 'next'

interface PostProps {
  params: {
    slug: string
  }
}

async function getPostBySlug(slug: string) {
  const posts = await getPosts()
  return posts.find(post => post.slug === slug)
}

export async function generateMetadata({ params }: PostProps): Promise<Metadata> {
  const post = await getPostBySlug(params.slug)
  if (post == null) return {}
  return { title: post.title, description: post.description }
}

export async function generateStaticParams(): Promise<PostProps['params'][]> {
  const posts = await getPosts()
  return posts.map(post => ({
    slug: post.slug
  }))
}

export default async function PostPage({ params }: PostProps) {
  const post = await getPostBySlug(params.slug)

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
