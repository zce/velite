module.exports = {
  root: 'test',
  output: {
    data: 'data',
    static: 'static',
    public: '/static'
  },
  schemas: {
    posts: {
      name: 'Post',
      pattern: 'posts/*.md',
      type: 'markdown',
      fields: {
        title: { type: 'string', required: true }
      }
    }
  }
}
