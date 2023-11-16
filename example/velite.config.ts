import { defineConfig, s, z } from 'velite'

const slugify = input =>
  input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

const icon = z.enum(['github', 'instagram', 'medium', 'twitter', 'youtube'])
const count = z.object({ total: z.number(), posts: z.number() }).default({ total: 0, posts: 0 })

export default defineConfig({
  root: 'content',
  output: {
    data: '.velite',
    static: 'public',
    filename: '/static/[name]-[hash:6].[ext]'
  },
  clean: true,
  verbose: true,
  schemas: {
    options: {
      name: 'Option',
      pattern: 'options/index.yml',
      single: true,
      fields: z.object({
        name: s.name(),
        title: s.title(),
        description: s.paragraph().optional(),
        keywords: z.array(z.string()),
        author: z.object({ name: z.string(), email: z.string().email(), url: z.string().url() }),
        links: z.array(z.object({ text: z.string(), link: z.string(), type: z.enum(['navigation', 'footer', 'copyright']) })),
        socials: z.array(z.object({ name: z.string(), icon, link: z.string().optional(), image: s.image().optional() }))
      })
    },
    categories: {
      name: 'Category',
      pattern: 'categories/index.yml',
      fields: z
        .object({
          name: s.name(),
          slug: s.slug('global'),
          cover: s.image().optional(),
          description: s.paragraph().optional(),
          count
        })
        .transform(data => ({ ...data, permalink: `/${data.slug}` }))
    },
    tags: {
      name: 'Tag',
      pattern: 'tags/index.yml',
      fields: z
        .object({
          name: s.name(),
          slug: s.slug('global'),
          cover: s.image().optional(),
          description: s.paragraph().optional(),
          count
        })
        .transform(data => ({ ...data, permalink: `/${data.slug}` }))
    },
    // pages: {
    //   name: 'Page',
    //   pattern: 'pages/**/*.mdx',
    //   fields: z
    //     .object({
    //       title: s.title(),
    //       slug: s.slug('post'),
    //       body: s.mdx()
    //     })
    //     .transform(data => ({ ...data, permalink: `/${data.slug}/${data.slug}` }))
    // },
    posts: {
      name: 'Post',
      pattern: 'posts/**/*.md',
      fields: z
        .object({
          title: s.title(),
          slug: s.slug('post'),
          date: s.date(),
          updated: s.date().optional(),
          cover: s.image().optional(),
          description: s.paragraph().optional(),
          draft: z.boolean().default(false),
          featured: z.boolean().default(false),
          categories: z.array(z.string()).default(['Journal']),
          tags: z.array(z.string()).default([]),
          meta: s.meta(),
          body: s.markdown()
        })
        .transform(data => ({ ...data, permalink: `/${data.slug}/${data.slug}` }))
    }
  },
  onSuccess: ({ categories, tags, posts }) => {
    const docs = posts.filter(i => process.env.NODE_ENV !== 'production' || !i.draft)

    // missing categories, tags from posts or courses inlined
    const categoriesFromDoc = Array.from(new Set(docs.map(item => item.categories).flat())).filter(i => categories.find(j => j.name === i) == null)
    categories.push(...categoriesFromDoc.map(name => ({ name, slug: slugify(name), permalink: '', count: { total: 0, posts: 0 } })))
    categories.forEach(i => {
      i.count = i.count || {}
      i.count.posts = posts.filter(j => j.categories.includes(i.name)).length
      i.count.total = i.count.posts
      i.permalink = `/${i.slug}`
    })

    const tagsFromDoc = Array.from(new Set(docs.map(item => item.tags).flat())).filter(i => tags.find(j => j.name === i) == null)
    tags.push(...tagsFromDoc.map(name => ({ name, slug: slugify(name), permalink: '', count: { total: 0, posts: 0 } })))
    tags.forEach(i => {
      i.count = i.count || {}
      i.count.posts = posts.filter(j => j.tags.includes(i.name)).length
      i.count.total = i.count.posts
      i.permalink = `/${i.slug}`
    })
  }
})
