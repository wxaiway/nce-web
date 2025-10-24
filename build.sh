#!/bin/bash

# NCE - 自动化构建脚本
# 用于在全新环境中从源码构建生产版本

set -e  # 遇到错误立即退出

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "========================================"
echo "NCE - 自动化构建脚本"
echo "========================================"
echo ""

# 检查 Node.js
echo -e "${BLUE}[1/5] 检查环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到 Node.js${NC}"
    echo "请先安装 Node.js (v18.0.0+)"
    echo "访问: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js 版本: $NODE_VERSION${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: 未找到 npm${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm 版本: $NPM_VERSION${NC}"
echo ""

# 检查磁盘空间
echo -e "${BLUE}[2/5] 检查磁盘空间...${NC}"
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
echo -e "${GREEN}✓ 可用空间: $AVAILABLE_SPACE${NC}"
echo -e "${YELLOW}提示: 构建需要约 1GB 空间${NC}"
echo ""

# 清理旧的构建产物
echo -e "${BLUE}[3/5] 清理旧的构建产物...${NC}"
if [ -d "dist" ]; then
    echo "删除旧的 dist/ 目录..."
    rm -rf dist
    echo -e "${GREEN}✓ 清理完成${NC}"
else
    echo "无需清理"
fi
echo ""

# 安装依赖
echo -e "${BLUE}[4/5] 安装依赖...${NC}"
if [ ! -d "node_modules" ]; then
    echo "首次安装，这可能需要几分钟..."
    npm install
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
else
    echo "node_modules 已存在，检查是否需要更新..."
    npm install
    echo -e "${GREEN}✓ 依赖检查完成${NC}"
fi
echo ""

# 构建生产版本
echo -e "${BLUE}[5/5] 构建生产版本...${NC}"
echo "开始构建..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ 构建成功！${NC}"
else
    echo ""
    echo -e "${RED}✗ 构建失败${NC}"
    exit 1
fi
echo ""

# 显示构建结果
echo "========================================"
echo -e "${GREEN}构建完成！${NC}"
echo "========================================"
echo ""
echo "构建产物位置: $(pwd)/dist"
echo ""
echo "目录结构:"
ls -lh dist/*.html 2>/dev/null || echo "  (HTML 文件)"
echo ""
echo "资源统计:"
echo "  - HTML 文件: $(find dist -name "*.html" | wc -l | tr -d ' ') 个"
echo "  - JS 文件: $(find dist/assets -name "*.js" 2>/dev/null | wc -l | tr -d ' ') 个"
echo "  - CSS 文件: $(find dist/assets -name "*.css" 2>/dev/null | wc -l | tr -d ' ') 个"
echo "  - MP3 文件: $(find dist -name "*.mp3" 2>/dev/null | wc -l | tr -d ' ') 个"
echo "  - LRC 文件: $(find dist -name "*.lrc" 2>/dev/null | wc -l | tr -d ' ') 个"
echo ""
echo "总大小: $(du -sh dist | cut -f1)"
echo ""
echo "========================================"
echo "下一步操作："
echo "========================================"
echo ""
echo "1. 上传到服务器："
echo "   rsync -avz dist/ user@server:/var/www/nce/"
echo ""
echo "2. 配置 Nginx（参考 nginx.conf.example）"
echo "   sudo cp nginx.conf.example /etc/nginx/sites-available/nce"
echo "   sudo ln -s /etc/nginx/sites-available/nce /etc/nginx/sites-enabled/"
echo "   sudo nginx -t"
echo "   sudo systemctl restart nginx"
echo ""
echo "3. 查看完整部署文档："
echo "   cat DEPLOY.md"
echo ""
