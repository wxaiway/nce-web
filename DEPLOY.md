# NCE - 部署文档

## 📋 部署概述

本文档说明如何在全新的服务器环境中部署 NCE 项目。

> **注意**:
> - 文档中的 `your-domain.com` 需要替换为实际的域名

## 🔧 环境要求

### 服务器环境
- **操作系统**: Linux (推荐 Ubuntu 20.04+ / CentOS 7+)
- **Node.js**: v18.0.0 或更高版本
- **npm**: v9.0.0 或更高版本
- **Nginx**: v1.18.0 或更高版本
- **Git**: v2.0.0 或更高版本

### 磁盘空间
- 源码: ~10 MB
- node_modules: ~200 MB
- 构建产物 (dist): ~700 MB
- **建议预留**: 2 GB 以上

## 🚀 快速部署（推荐）

### 方式一：使用自动化脚本

```bash
# 1. 克隆代码
git clone https://github.com/wxaiway/nce-web.git /var/www/nce
cd /var/www/nce

# 2. 执行构建脚本（会自动安装依赖并构建）
chmod +x build.sh
./build.sh

# 3. 构建产物在 dist/ 目录
# 可以直接将 dist/ 目录配置为 Nginx 根目录
```

### 方式二：手动部署

```bash
# 1. 克隆代码
git clone https://github.com/wxaiway/nce-web.git /var/www/nce
cd /var/www/nce

# 2. 安装 Node.js 依赖
npm install

# 3. 构建生产版本
npm run build

# 4. 构建产物在 dist/ 目录
ls -lh dist/
```

## 📦 构建产物说明

**重要提示**：构建产物默认配置为部署在 `/nce/` 子路径：
- ✅ **适合子路径部署**（如 `a.com/nce/`）
- ✅ **所有资源路径自动处理**（包括 JS、CSS、音频、数据文件）
- ✅ **动态请求路径自动适配**（使用 `import.meta.env.BASE_URL`）
- ⚠️ **如需部署在根路径**（`a.com/`），需修改 `vite.config.js` 中的 `base: '/'` 并重新构建

### 修改部署路径

如果需要部署在不同路径，修改 `vite.config.js`：

```javascript
export default defineConfig({
  // 根路径部署
  base: '/',

  // 或子路径部署
  base: '/nce/',

  // 或其他路径
  base: '/apps/english/',
});
```

修改后需要重新构建：`npm run build`

### 本地预览构建产物

```bash
# 方式 1: 使用 Vite 预览服务器（推荐）
npm run preview
# 访问 http://localhost:4173

# 方式 2: 使用 Python HTTP 服务器
cd dist
python3 -m http.server 8000
# 访问 http://localhost:8000

# 方式 3: 使用 Node.js http-server
npx http-server dist -p 8000
# 访问 http://localhost:8000
```

构建完成后，`dist/` 目录结构如下：

```
dist/
├── index.html          # 首页
├── lesson.html         # 课程页
├── book.html           # 书籍页
├── guide.html          # 学习指导页
├── assets/             # JS/CSS 打包文件（带 hash）
│   ├── *.js
│   └── *.css
├── NCE1/               # 新概念英语第一册（MP3 + LRC）
├── NCE2/               # 新概念英语第二册
├── NCE3/               # 新概念英语第三册
└── NCE4/               # 新概念英语第四册
```

**大小统计**:
- HTML 文件: ~20 KB
- JS/CSS 文件: ~40 KB
- 音频资源: ~700 MB (276 个 MP3 + 276 个 LRC)
- **总计**: ~700 MB

## 🔧 Nginx 配置

### 1. 创建 Nginx 配置文件

```bash
sudo nano /etc/nginx/sites-available/nce
```

### 2. 配置内容（参考 `nginx.conf.example`）

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 修改为你的域名

    # 网站根目录（指向构建产物）
    root /var/www/nce/dist;
    index index.html;

    # 日志
    access_log /var/log/nginx/nce_access.log;
    error_log /var/log/nginx/nce_error.log;

    # 启用 gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/javascript application/json;

    # 静态资源缓存（带 hash 的 JS/CSS）
    location ~* ^/assets/.*\.(js|css)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 音频文件缓存
    location ~* \.(mp3|lrc)$ {
        expires 30d;
        add_header Cache-Control "public";
    }

    # HTML 文件不缓存
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # 默认路由
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 3. 启用配置并重启 Nginx

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/nce /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 4. 子路径部署配置（可选）

如果需要部署在子路径（如 `a.com/nce/`），使用以下配置：

```nginx
server {
    listen 80;
    server_name a.com;

    # 其他应用的配置...

    # NCE 应用（子路径部署）
    location /nce/ {
        alias /var/www/nce/dist/;
        index index.html;
        try_files $uri $uri/ /nce/index.html;

        # 启用 gzip
        gzip on;
        gzip_types text/css application/javascript application/json;

        # 缓存策略
        location ~ ^/nce/assets/.*\.(js|css)$ {
            alias /var/www/nce/dist/assets/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        location ~ ^/nce/.*\.(mp3|lrc)$ {
            expires 30d;
            add_header Cache-Control "public";
        }
    }
}
```

**说明**：
- 使用 `alias` 而不是 `root`
- `try_files` 的回退路径需要包含 `/nce/` 前缀
- 资源路径匹配需要包含 `/nce/` 前缀

## 🔄 更新部署

### 方式一：本地构建 + 上传（推荐）

```bash
# 1. 本地拉取最新代码
git pull origin main

# 2. 本地构建
./build.sh

# 3. 上传到服务器
rsync -avz --delete dist/ user@server:/var/www/nce/

# 4. 重启 Nginx（如需要）
ssh user@server "sudo systemctl reload nginx"
```

**优点**：
- ✅ 不占用服务器资源
- ✅ 构建失败不影响线上服务
- ✅ 可以本地测试后再上传

### 方式二：服务器上更新（不推荐）

如果必须在服务器上更新：

```bash
cd /var/www/nce

# 1. 拉取最新代码
git pull origin main

# 2. 安装新依赖（如果有）
npm install

# 3. 重新构建
./build.sh

# 4. Nginx 会自动使用新的 dist/ 目录
```

**注意**：
- ⚠️ 服务器上构建会消耗资源（CPU、内存）
- ⚠️ 构建时间较长（5-10分钟）
- ⚠️ 构建失败可能影响服务

## 🌐 HTTPS 配置（可选）

### 使用 Let's Encrypt 免费证书

```bash
# 1. 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 2. 获取证书并自动配置 Nginx
sudo certbot --nginx -d your-domain.com

# 3. 自动续期（certbot 会自动配置 cron）
sudo certbot renew --dry-run
```

## 📊 性能优化建议

### 1. 使用 CDN 加速音频资源

如果用户量大，建议将 `NCE1-4` 目录上传到 CDN：

```bash
# 示例：上传到阿里云 OSS
ossutil cp -r dist/NCE1 oss://your-bucket/nce/NCE1
ossutil cp -r dist/NCE2 oss://your-bucket/nce/NCE2
ossutil cp -r dist/NCE3 oss://your-bucket/nce/NCE3
ossutil cp -r dist/NCE4 oss://your-bucket/nce/NCE4
```

然后修改代码中的资源路径为 CDN 地址。

### 2. 启用 HTTP/2

在 Nginx 配置中添加：

```nginx
listen 443 ssl http2;
```

### 3. 增加 Nginx 缓存

```nginx
# 在 http 块中添加
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=nce_cache:10m max_size=1g inactive=60m;
```

## 🐛 故障排查

### 1. 构建失败

**问题**: `npm run build` 失败

**解决**:
```bash
# 清理缓存重试
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 2. 音频文件 404

**问题**: 浏览器控制台显示音频文件找不到

**检查**:
```bash
# 确认文件存在
ls -lh dist/NCE1/*.mp3

# 检查 Nginx 配置的 root 路径是否正确
sudo nginx -T | grep root
```

### 3. 页面样式错误

**问题**: 页面显示但样式丢失

**检查**:
```bash
# 确认 assets 目录存在
ls -lh dist/assets/

# 检查浏览器控制台是否有 CORS 错误
# 检查 Nginx 配置是否正确
```

### 4. Nginx 403 错误

**问题**: 访问网站显示 403 Forbidden

**解决**:
```bash
# 检查文件权限
sudo chmod -R 755 /var/www/nce/dist

# 检查 Nginx 用户权限
sudo chown -R www-data:www-data /var/www/nce/dist
```

## 📝 检查清单

部署完成后，请检查以下项目：

- [ ] 所有页面能正常访问
  - [ ] 首页 (index.html)
  - [ ] 课程页 (lesson.html)
  - [ ] 书籍页 (book.html)
  - [ ] 学习指导页 (guide.html)
- [ ] 音频播放功能正常
- [ ] 页面跳转正常
- [ ] 移动端适配正常
- [ ] 浏览器控制台无错误
- [ ] Nginx 日志无异常

## 🔗 相关文件

- `build.sh` - 自动化构建脚本
- `nginx.conf.example` - Nginx 配置示例
- `vite.config.js` - Vite 构建配置

## 📞 技术支持

如有问题，请查看：
- 项目 README.md
- GitHub Issues
- Nginx 错误日志: `/var/log/nginx/nce_error.log`
