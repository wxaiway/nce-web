import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

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
  },

  plugins: [
    {
      name: 'markdown-loader',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.endsWith('.md')) {
            try {
              const decodedUrl = decodeURIComponent(req.url);
              const relativePath = decodedUrl.replace('/nce/', '');
              const filePath = path.join(__dirname, 'public', relativePath);

              if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end(content);
                return;
              } else {
                // 文件不存在，返回 404
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end('Not Found');
                return;
              }
            } catch (error) {
              console.error('Markdown loader error:', error);
              res.statusCode = 500;
              res.end('Internal Server Error');
              return;
            }
          }
          next();
        });
      }
    }
  ]
});
