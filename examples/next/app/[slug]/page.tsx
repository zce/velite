import { notFound } from 'next/navigation'

import { MDXContent } from '@/components/mdx-content'
import * as db from '#site/content'

import type { Metadata } from 'next'

interface PageProps {
  params: {
    slug: string
  }
}

async function getPageBySlug(slug: string) {
  const pages = await db.pages()
  return pages.find(page => page.slug === slug)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const page = await getPageBySlug(params.slug)
  if (page == null) return {}
  return { title: page.title }
}

export async function generateStaticParams(): Promise<PageProps['params'][]> {
  const pages = await db.pages()
  return pages.map(page => ({
    slug: page.slug
  }))
}

export default async function PagePage({ params }: PageProps) {
  const page = await getPageBySlug(params.slug)

  if (page == null) notFound()

  return (
    <article className="prose py-6 dark:prose-invert">
      <h1>{page.title}</h1>
      <hr />
      <MDXContent code={page.body} />
    </article>
  )
}
