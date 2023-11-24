import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Velite',
  description: "Turns Markdown, YAML, JSON, or other files into app's data layer with type-safe schema.",
  lastUpdated: true,
  cleanUrls: true,
  head: [
    ['meta', { name: 'theme-color', content: '#1b1b1f' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'Velite' }],
    ['meta', { name: 'og:image', content: 'https://velite.js.org/velite-og.png' }]
  ],
  // locales: {
  //   root: { label: 'English', lang: 'en', link: '/' },
  //   'zh-CN': {
  //     label: '简体中文',
  //     lang: 'zh-CN',
  //     link: '/zh-CN/',
  //     description: '使用类型安全的模式将 Markdown、YAML、JSON 或其他文件转换为应用程序的数据层。'
  //   }
  // },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    siteTitle: false,
    logo: {
      light: '/assets/nav-logo-light.svg',
      dark: '/assets/nav-logo-dark.svg',
      alt: 'Velite'
    },
    search: {
      provider: 'local'
    },
    editLink: {
      text: 'Edit this page on GitHub',
      pattern: 'https://github.com/zce/velite/edit/main/docs/:path'
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/zce/velite' }],
    footer: {
      message: 'Distributed under the MIT License.',
      copyright: '© 2023 Lei, All rights reserved.'
    },
    nav: [
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'Reference', link: '/reference/config', activeMatch: '/references/' },
      { text: 'Examples', link: '/examples/basic', activeMatch: '/examples/' }
    ],
    sidebar: {
      '/guide/': {
        base: '/guide/',
        items: [
          {
            text: 'Getting Started',
            items: [
              { text: 'Introduction', link: 'introduction' },
              { text: 'Quick Start', link: 'quick-start' },
              { text: 'Define Collections', link: 'define-collections' },
              { text: 'Using Collections', link: 'using-collections' },
              { text: 'Field Schemas', link: 'field-shemas' }
            ]
          },
          {
            text: 'Recipes',
            items: [
              { text: 'TypeScript', link: 'typescript' },
              { text: 'Markdown', link: 'using-markdown' },
              { text: 'Asset Handling', link: 'asset-handling' },
              { text: 'MDX Support', link: 'using-mdx' },
              { text: 'Integration with Next.js', link: 'with-nextjs' }
            ]
          },
          {
            text: 'Advanced',
            items: [
              { text: 'Custom Loader', link: 'custom-loader' }
              // { text: 'Fast Refresh', link: 'fast-refresh' }
            ]
          },
          {
            text: 'Concepts',
            items: [
              { text: 'How It Works', link: 'how-it-works' }
              // { text: 'Motivation', link: 'motivation' }
            ]
          },
          {
            text: 'Other',
            base: '/other/',
            items: [
              { text: 'Snippets', link: 'snippets' },
              { text: 'Roadmap', link: 'roadmap' },
              { text: 'FAQ', link: 'faq' }
            ]
          }
        ]
      },
      '/reference/': {
        base: '/reference/',
        items: [
          {
            text: 'Reference',
            link: '/',
            items: [
              { text: 'Configuration', link: 'config' },
              { text: 'Velite CLI', link: 'cli' }
            ]
          }
        ]
      }
    }
  }
})
