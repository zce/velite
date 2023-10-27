import { defineConfig } from '.'

export default defineConfig({
  collections: [
    {
      name: 'Post',
      pattern: 'posts/*.md',
      type: 'markdown',
      fields: [
        {
          name: 'title',
          type: 'string',
          required: true
        }
      ],
      computed: [
        {
          name: 'slug',
          resolve: doc => {
            // return post.title.toLowerCase().replace(/ /g, '-')
          }
        }
      ],
    }
  ]
})
