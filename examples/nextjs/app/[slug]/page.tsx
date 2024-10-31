import { notFound } from 'next/navigation'

import { MDXContent } from '@/components/mdx-content'
import { pages } from '#site/content'

type Props = {
  params: Promise<{ slug: string }>
}

function getPageBySlug(slug: string) {
  return pages.find(page => page.slug === slug)
}

export default async function PagePage({ params }: Props) {
  const { slug } = await params
  const page = getPageBySlug(slug)

  if (page == null) notFound()

  return (
    <article className="prose dark:prose-invert py-6">
      <h1>{page.title}</h1>
      <hr />
      <MDXContent code={page.body} name="props for mdx" />
    </article>
  )
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const page = getPageBySlug(slug)
  if (page == null) return {}
  return { title: page.title }
}

export function generateStaticParams() {
  return pages.map(page => ({ slug: page.slug }))
}
