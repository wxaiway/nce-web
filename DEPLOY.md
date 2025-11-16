# NCE - 部署文档

## 📋 部署概述

本文档说明如何在全新的服务器环境中部署 NCE 项目。

> **注意**:
> - 文档中的 `your-domain.com` 需要替换为实际的域名

## 🔧 环境要求

- **服务器**: Linux (Ubuntu 20.04+ / CentOS 7+)
- **软件**: Node.js 18+ | npm 9+ | Nginx 1.18+ | Git 2.0+
- **磁盘**: 2 GB 以上（构建产物 ~750 MB）

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

**默认配置**: 部署在 `/nce/` 子路径（如 `a.com/nce/`）

**修改部署路径**: 编辑 `vite.config.js` 中的 `base` 配置后重新构建

```javascript
base: '/',        // 根路径部署
base: '/nce/',    // 子路径部署（默认）
```

**本地预览**: `npm run preview` 或 `npx http-server dist -p 8000`

**构建产物**: ~750 MB（HTML/JS/CSS ~150 MB + 音频资源 ~750 MB）

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

**推荐方式**：本地构建 + rsync 上传（不占用服务器资源，构建失败不影响线上）

```bash
git pull origin main && ./build.sh
rsync -avz --delete dist/ user@server:/var/www/nce/
```

**服务器直接更新**（不推荐，会消耗服务器资源）：

```bash
cd /var/www/nce && git pull origin main && ./build.sh
```

## 🌐 HTTPS 配置（可选）

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 📊 性能优化（可选）

- **CDN 加速**: 将 NCE1-4 音频目录上传到 CDN（阿里云 OSS、腾讯云 COS 等）
- **HTTP/2**: Nginx 配置添加 `listen 443 ssl http2;`
- **Nginx 缓存**: 添加 `proxy_cache_path` 配置

## 🐛 故障排查

| 问题 | 解决方案 |
|------|---------|
| 构建失败 | `rm -rf node_modules package-lock.json && npm install && npm run build` |
| 音频 404 | 检查 `dist/NCE1/*.mp3` 是否存在，检查 Nginx root 路径 |
| 样式丢失 | 检查 `dist/assets/` 是否存在，检查浏览器控制台 CORS 错误 |
| Nginx 403 | `sudo chmod -R 755 /var/www/nce/dist && sudo chown -R www-data:www-data /var/www/nce/dist` |

## 📝 检查清单

- [ ] 所有页面正常访问（首页、课程、单词练习、听写等）
- [ ] 课文/单词音频播放正常
- [ ] 播放速度保持（切换课程/自动续播）
- [ ] 移动端音频自动播放（点击开始按钮）
- [ ] 历史记录进入听写正常
- [ ] 卡片学习、浏览模式、默写稿、PDF 生成正常
- [ ] 移动端/iPad 布局正常
- [ ] 浏览器控制台无错误
- [ ] Nginx 日志无异常

## 📞 技术支持

- 项目文档: [README.md](README.md) | [CONTRIBUTING.md](CONTRIBUTING.md)
- 问题反馈: [GitHub Issues](https://github.com/wxaiway/nce-web/issues)
- Nginx 日志: `/var/log/nginx/nce_error.log`
