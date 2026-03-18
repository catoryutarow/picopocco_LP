import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        blog: resolve(__dirname, 'blog.html'),
        post: resolve(__dirname, 'post.html'),
        goods: resolve(__dirname, 'goods.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
})
