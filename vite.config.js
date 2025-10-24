import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // 部署在子路径 /nce/
  // 如果部署在根路径，改为 base: '/'
  base: '/nce/',

  root: 'src',
  publicDir: '../public',

  build: {
    outDir: '../dist',
    emptyOutDir: true,

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        lesson: resolve(__dirname, 'src/lesson.html'),
        book: resolve(__dirname, 'src/book.html'),
        guide: resolve(__dirname, 'src/guide.html')
      }
    },

    // 生产环境优化
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },

  server: {
    port: 8080,
    open: true
  }
});
