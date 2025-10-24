# 开发指南

欢迎参与 NCE 项目的开发！本文档提供了开发相关的指南和最佳实践。

## 📁 项目结构

```
NCE/
├── src/                    # 源代码
│   ├── js/
│   │   ├── core/          # 核心模块
│   │   │   ├── lrc-parser.js      # LRC 解析
│   │   │   └── audio-player.js    # 音频播放
│   │   ├── ui/            # UI 组件
│   │   │   ├── settings-panel.js  # 设置面板
│   │   │   └── shortcuts.js       # 快捷键
│   │   ├── utils/         # 工具函数
│   │   │   ├── event-emitter.js   # 事件系统
│   │   │   └── storage.js         # 本地存储
│   │   ├── app.js         # 全局应用
│   │   └── lesson.js      # 课文页入口
│   ├── css/
│   │   └── styles.css     # 样式文件
│   ├── index.html         # 首页
│   ├── lesson.html        # 课文页
│   └── book.html          # 重定向页
├── public/                # 静态资源
│   ├── NCE1/              # 第一册音频和字幕
│   ├── NCE2/              # 第二册
│   ├── NCE3/              # 第三册
│   ├── NCE4/              # 第四册
│   └── static/
│       └── data.json      # 课程元数据
├── dist/                  # 构建输出
├── package.json
├── vite.config.js
└── README.md
```

## 🛠️ 技术栈

- **构建工具**: Vite 5.x
- **语言**: 纯原生 JavaScript (ES6+)
- **样式**: 原生 CSS (CSS Variables)
- **架构**: 模块化设计，零运行时依赖

## 🚀 开发环境设置

### 1. 克隆项目

```bash
git clone https://github.com/wxaiway/nce-web.git
cd nce-web
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:8080

### 4. 构建生产版本

```bash
# 使用构建脚本（推荐）
./build.sh

# 或直接构建
npm run build
```

## 📝 代码规范

### 代码检查和格式化

```bash
# 代码检查
npm run lint

# 自动修复
npm run lint:fix

# 代码格式化
npm run format
```

### 编码规范

1. 使用 ES6+ 模块语法（import/export）
2. 使用 JSDoc 注释说明函数和类
3. 遵循现有代码风格
4. 变量和函数使用驼峰命名
5. 类名使用帕斯卡命名

## 🏗️ 架构设计

### 模块化设计

项目采用模块化架构，职责清晰分离：

- **core/**: 核心业务逻辑（LRC 解析、音频播放）
- **ui/**: UI 组件（设置面板、快捷键）
- **utils/**: 通用工具（事件系统、本地存储）

### 事件驱动

使用 EventEmitter 实现组件间通信，避免紧耦合。

## 📚 核心模块 API

### LRCParser

LRC 字幕解析器，支持两种格式：

```javascript
import { LRCParser } from './core/lrc-parser.js';

const { meta, items } = LRCParser.parse(lrcText);
```

**返回值**：
- `meta`: 元数据对象（ti, ar, al 等）
- `items`: 句子数组，每个元素包含 `{ start, end, en, cn }`

### AudioPlayer

音频播放控制器，基于事件驱动：

```javascript
import { AudioPlayer } from './core/audio-player.js';

const player = new AudioPlayer(audioElement, items);

// 监听事件
player.on('sentencechange', ({ idx }) => {
  console.log('当前句子:', idx);
});

// 播放指定句子
player.playSegment(0);
```

**主要方法**：
- `playSegment(idx, manual)`: 播放指定句子
- `prev()`: 上一句
- `next()`: 下一句
- `replay()`: 重播当前句

**主要事件**：
- `sentencechange`: 句子切换
- `lessonend`: 课程结束
- `error`: 错误

### EventEmitter

简单的事件系统：

```javascript
import { EventEmitter } from './utils/event-emitter.js';

const emitter = new EventEmitter();
emitter.on('event', (data) => console.log(data));
emitter.emit('event', { message: 'Hello' });
```

### Storage

本地存储工具，自动处理 JSON 序列化：

```javascript
import { Storage } from './utils/storage.js';

Storage.set('key', { value: 123 });
const data = Storage.get('key');
```

## 🎯 添加新功能

### 步骤

1. 在 `src/js/` 对应目录创建模块
2. 使用 ES6 模块导入/导出
3. 遵循现有代码风格
4. 添加必要的 JSDoc 注释
5. 测试功能是否正常
6. 提交 Pull Request

### 示例：添加新的 UI 组件

```javascript
// src/js/ui/my-component.js

/**
 * 我的组件
 */
export class MyComponent {
  constructor() {
    this.init();
  }

  init() {
    // 初始化逻辑
  }
}
```

## 🐛 调试技巧

### 开发者工具

- 使用浏览器开发者工具的 Console 查看日志
- 使用 Network 面板检查资源加载
- 使用 Application 面板查看 LocalStorage

### 常见问题

1. **音频不播放**：检查浏览器自动播放策略
2. **样式错误**：检查 CSS Variables 是否正确
3. **路径 404**：检查 `vite.config.js` 中的 `base` 配置

## 🧪 测试

### 手动测试清单

- [ ] 首页课程列表显示正常
- [ ] 点击课程能正常跳转
- [ ] 音频播放正常
- [ ] 句子高亮和滚动正常
- [ ] 快捷键功能正常
- [ ] 设置面板功能正常
- [ ] 学习进度保存正常
- [ ] 移动端适配正常
- [ ] iOS Safari 兼容性正常

### 浏览器兼容性

- Chrome/Edge (最新版)
- Firefox (最新版)
- Safari (最新版)
- iOS Safari (iOS 14+)

## 📦 构建和部署

### 构建配置

项目使用 Vite 构建，配置文件：`vite.config.js`

**重要配置**：
- `base`: 部署路径（默认 `/nce/`）
- `publicDir`: 静态资源目录
- `outDir`: 输出目录

### 部署

详细部署说明请查看 [DEPLOY.md](DEPLOY.md)

## 🤝 贡献流程

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📞 获取帮助

如有问题，请：
- 查看 [README.md](README.md)
- 查看 [DEPLOY.md](DEPLOY.md)
- 提交 GitHub Issue

## 📄 许可证

MIT License
