import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Velite',
  description: "Velite is a tool for building type-safe data layer, turn Markdown/MDX, YAML, JSON, or other files into app's data layer with Zod schema.",
  lastUpdated: true,
  cleanUrls: true,
  head: [
    ['meta', { name: 'theme-color', content: '#1b1b1f' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'Velite' }],
    ['meta', { name: 'og:image', content: 'https://velite.js.org/velite-og.jpg' }]
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
      { text: 'Reference', link: '/reference/config', activeMatch: '/reference/' },
      { text: 'Examples', link: '/examples/basic', activeMatch: '/examples/' }
    ],
    sidebar: [
      {
        text: 'Getting Started',
        base: '/guide/',
        items: [
          { text: 'Introduction', link: 'introduction' },
          { text: 'Quick Start', link: 'quick-start' },
          { text: 'Define Collections', link: 'define-collections' },
          { text: 'Using Collections', link: 'using-collections' },
          { text: 'Velite Schemas', link: 'velite-shemas' }
        ]
      },
      {
        text: 'Recipes',
        base: '/guide/',
        items: [
          { text: 'TypeScript', link: 'typescript' },
          { text: 'Markdown', link: 'using-markdown' },
          { text: 'MDX Support', link: 'using-mdx' },
          { text: 'Asset Handling', link: 'asset-handling' },
          { text: 'Integration with Next.js', link: 'with-nextjs' },
          { text: 'Custom Loader', link: 'custom-loader' }
          // { text: 'Fast Refresh', link: 'fast-refresh' }
        ]
      },
      {
        text: 'Reference',
        base: '/reference/',
        items: [
          { text: 'Configuration', link: 'config' },
          { text: 'JavaScript API', link: 'api' },
          { text: 'Velite CLI', link: 'cli' },
          { text: 'Types', link: 'types' }
        ]
      },
      {
        text: 'Examples',
        base: '/examples/',
        items: [
          { text: 'Basic', link: 'basic' },
          { text: 'Next.js', link: 'nextjs' }
        ]
      },
      {
        text: 'Concepts',
        base: '/guide/',
        items: [
          { text: 'How Velite Works', link: 'how-it-works' },
          { text: 'Motivation', link: 'motivation' }
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
  }
})
