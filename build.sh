#!/bin/bash

# NCE - 自动化构建脚本
# 用于构建可部署到子目录的生产版本

set -e  # 遇到错误立即退出

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认子目录路径，可通过参数覆盖: ./build.sh /custom-path/
PUBLIC_PATH="${1:-/nce/}"

echo ""
echo "========================================"
echo "NCE - 自动化构建脚本"
echo "========================================"
echo ""
echo -e "${YELLOW}部署路径: ${PUBLIC_PATH}${NC}"
echo ""

# 检查 Node.js
echo -e "${BLUE}[1/6] 检查环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到 Node.js${NC}"
    echo "请先安装 Node.js (v18.0.0+)"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js 版本: $NODE_VERSION${NC}"

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}未找到 pnpm，正在自动安装...${NC}"
    npm install -g pnpm
    if ! command -v pnpm &> /dev/null; then
        echo -e "${RED}错误: pnpm 安装失败，请手动安装: npm install -g pnpm${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ pnpm 安装成功${NC}"
fi

PNPM_VERSION=$(pnpm -v)
echo -e "${GREEN}✓ pnpm 版本: $PNPM_VERSION${NC}"
echo ""

# 检查磁盘空间
echo -e "${BLUE}[2/6] 检查磁盘空间...${NC}"
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
echo -e "${GREEN}✓ 可用空间: $AVAILABLE_SPACE${NC}"
echo ""

# 清理旧的构建产物
echo -e "${BLUE}[3/6] 清理旧的构建产物...${NC}"
if [ -d "dist" ]; then
    echo "删除旧的 dist/ 目录..."
    rm -rf dist
    echo -e "${GREEN}✓ 清理完成${NC}"
else
    echo "无需清理"
fi
echo ""

# 安装依赖
echo -e "${BLUE}[4/6] 安装依赖...${NC}"
if [ ! -d "node_modules" ]; then
    echo "首次安装，这可能需要几分钟..."
    pnpm install
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
else
    echo "node_modules 已存在，检查是否需要更新..."
    pnpm install
    echo -e "${GREEN}✓ 依赖检查完成${NC}"
fi
echo ""

# 构建生产版本
echo -e "${BLUE}[5/6] 构建生产版本...${NC}"
echo "开始构建 (PUBLIC_PATH=${PUBLIC_PATH})..."
PUBLIC_PATH="$PUBLIC_PATH" pnpm run build

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ 构建成功！${NC}"
else
    echo ""
    echo -e "${RED}✗ 构建失败${NC}"
    exit 1
fi
echo ""

# 拷贝静态资源
echo -e "${BLUE}[6/6] 拷贝静态资源...${NC}"
if [ -d "public" ]; then
    cp -r public/* dist/
    echo -e "${GREEN}✓ 静态资源已拷贝到 dist/${NC}"
else
    echo "无 public 目录，跳过"
fi
echo ""

# 显示构建结果
echo "========================================"
echo -e "${GREEN}构建完成！${NC}"
echo "========================================"
echo ""
echo "构建产物位置: $(pwd)/dist"
echo "部署子路径: ${PUBLIC_PATH}"
echo ""
echo "资源统计:"
echo "  - HTML 文件: $(find dist -name "*.html" 2>/dev/null | wc -l | tr -d ' ') 个"
echo "  - JS 文件: $(find dist -name "*.js" 2>/dev/null | wc -l | tr -d ' ') 个"
echo "  - CSS 文件: $(find dist -name "*.css" 2>/dev/null | wc -l | tr -d ' ') 个"
echo ""
echo "总大小: $(du -sh dist | cut -f1)"
echo ""
echo "========================================"
echo "下一步操作："
echo "========================================"
echo ""
echo "1. 上传到服务器："
echo "   rsync -avz --delete dist/ user@server://opt/nginx/html${PUBLIC_PATH}"
echo ""
echo "2. Nginx 配置示例："
echo "   location ${PUBLIC_PATH} {"
echo "       alias /opt/nginx/html${PUBLIC_PATH};"
echo "       index index.html;"
echo "       try_files \$uri \$uri/ ${PUBLIC_PATH}index.html;"
echo "   }"
echo ""
