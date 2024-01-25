import Image from 'next/image'
import { notFound } from 'next/navigation'

import { posts } from '#site/content'

import type { Metadata } from 'next'

interface PostProps {
  params: {
    slug: string
  }
}

function getPostBySlug(slug: string) {
  return posts.find(post => post.slug === slug)
}

export function generateMetadata({ params }: PostProps): Metadata {
  const post = getPostBySlug(params.slug)
  if (post == null) return {}
  return { title: post.title, description: post.description }
}

export function generateStaticParams(): PostProps['params'][] {
  return posts.map(post => ({
    slug: post.slug
  }))
}

export default function PostPage({ params }: PostProps) {
  const post = getPostBySlug(params.slug)

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
