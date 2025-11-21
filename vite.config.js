import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// 读取版本信息
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;

// 获取 Git commit hash（短格式）
let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD').toString().trim();
} catch (error) {
  console.warn('无法获取 Git commit hash:', error.message);
}

// 获取构建时间
const buildTime = new Date().toISOString();

export default defineConfig({
  // 部署在子路径 /nce/
  // 如果部署在根路径，改为 base: '/'
  base: '/nce/',

  root: 'src',
  publicDir: '../public',

  // 定义全局常量，在构建时注入
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
    __BUILD_TIME__: JSON.stringify(buildTime)
  },

  build: {
    outDir: '../dist',
    emptyOutDir: true,

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        lesson: resolve(__dirname, 'src/lesson.html'),
        book: resolve(__dirname, 'src/book.html'),
        guide: resolve(__dirname, 'src/guide.html'),
        vocabulary: resolve(__dirname, 'src/vocabulary.html'),
        flashcard: resolve(__dirname, 'src/flashcard.html'),
        'flashcard-result': resolve(__dirname, 'src/flashcard-result.html'),
        browse: resolve(__dirname, 'src/browse.html'),
        printable: resolve(__dirname, 'src/printable.html'),
        'dictation-practice': resolve(__dirname, 'src/dictation-practice.html'),
        'dictation-play': resolve(__dirname, 'src/dictation-play.html'),
        'dictation-input': resolve(__dirname, 'src/dictation-input.html'),
        'dictation-result': resolve(__dirname, 'src/dictation-result.html')
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
