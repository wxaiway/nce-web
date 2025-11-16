# 开发指南

欢迎参与 NCE 项目的开发！本文档面向开发者和贡献者，提供详细的开发指南、架构说明和最佳实践。

如果你只是想使用本项目，请查看 [README.md](README.md)。

## 📁 项目结构

```
NCE/
├── src/                    # 源代码
│   ├── js/
│   │   ├── core/          # 核心模块
│   │   │   ├── lrc-parser.js      # LRC 解析
│   │   │   └── audio-player.js    # 音频播放
│   │   ├── ui/            # UI 组件
│   │   │   ├── lesson-tabs.js         # Tab 切换
│   │   │   ├── lesson-notes.js        # 讲解加载
│   │   │   ├── lesson-navigation.js   # 课程导航
│   │   │   ├── settings-panel.js      # 设置面板
│   │   │   └── shortcuts.js           # 快捷键
│   │   ├── vocabulary/    # 单词练习模块
│   │   │   ├── vocabulary.js      # 单词练习配置页
│   │   │   ├── flashcard.js       # 卡片学习
│   │   │   ├── browse.js          # 浏览模式
│   │   │   └── printable.js       # 默写稿生成
│   │   ├── dictation/     # 听写练习模块
│   │   │   ├── dictation-practice.js  # 在线听写
│   │   │   ├── dictation-play.js      # 线下听写播放
│   │   │   ├── dictation-input.js     # 答案录入
│   │   │   └── dictation-result.js    # 结果展示
│   │   ├── utils/         # 工具函数
│   │   │   ├── event-emitter.js       # 事件系统
│   │   │   ├── language-switcher.js   # 语言切换
│   │   │   ├── logger.js              # 日志工具
│   │   │   ├── storage.js             # 本地存储
│   │   │   ├── toast.js               # 提示消息
│   │   │   ├── focus-trap.js          # 焦点管理
│   │   │   ├── ios-helper.js          # iOS 优化
│   │   │   ├── wake-lock-manager.js   # 屏幕常亮管理（课文页）
│   │   │   ├── global-wake-lock.js    # 全局屏幕常亮（单词/听写页）
│   │   │   ├── history.js             # 历史记录管理
│   │   │   └── font-loader.js         # 字体加载（PDF生成）
│   │   ├── app.js         # 全局应用
│   │   └── lesson.js      # 课文页入口
│   ├── css/               # 样式文件（模块化）
│   │   ├── base.css           # 基础样式和变量
│   │   ├── components.css     # 组件样式
│   │   ├── layout.css         # 布局样式
│   │   ├── responsive.css     # 响应式样式
│   │   ├── vocabulary.css     # 单词练习样式
│   │   ├── flashcard.css      # 卡片学习样式
│   │   ├── browse.css         # 浏览模式样式
│   │   ├── printable.css      # 默写稿样式
│   │   ├── dictation.css      # 听写练习样式
│   │   └── styles.css         # 样式入口
│   ├── index.html         # 首页
│   ├── lesson.html        # 课文页
│   ├── guide.html         # 学习指导
│   ├── book.html          # 书籍页
│   ├── vocabulary.html    # 单词练习配置页
│   ├── flashcard.html     # 卡片学习页
│   ├── browse.html        # 浏览模式页
│   ├── printable.html     # 默写稿页
│   ├── dictation-practice.html  # 在线听写页
│   ├── dictation-play.html      # 线下听写播放页
│   ├── dictation-input.html     # 答案录入页
│   └── dictation-result.html    # 结果展示页
├── public/                # 静态资源
│   ├── NCE1/              # 第一册音频和字幕
│   ├── NCE2/              # 第二册
│   ├── NCE3/              # 第三册
│   ├── NCE4/              # 第四册
│   ├── words/             # 单词音频和数据
│   │   ├── nce1/          # 第一册单词音频
│   │   ├── nce2/          # 第二册单词音频
│   │   ├── nce3/          # 第三册单词音频
│   │   ├── nce4/          # 第四册单词音频
│   │   ├── nce1.json      # 第一册单词数据
│   │   ├── nce2.json      # 第二册单词数据
│   │   ├── nce3.json      # 第三册单词数据
│   │   └── nce4.json      # 第四册单词数据
│   ├── static/
│   │   └── data.json      # 课程元数据
│   └── default.md         # 默认讲解
├── dist/                  # 构建输出
├── package.json
├── vite.config.js
└── README.md
```

## 🚀 开发环境设置

```bash
# Fork 并克隆项目
git clone https://github.com/YOUR_USERNAME/nce-web.git
cd nce-web

# 安装依赖并启动
npm install
npm run dev

# 访问 http://localhost:8080/nce/
```

**常用命令**: `npm run dev` (开发) | `npm run build` (构建) | `npm run lint` (检查) | `npm run format` (格式化)

## 📝 代码规范

### 编码规范

**JavaScript**:
- 使用 ES6+ 模块语法（import/export）
- 使用 JSDoc 注释说明函数和类
- 变量和函数使用驼峰命名（camelCase）
- 类名使用帕斯卡命名（PascalCase）
- 使用 Logger 工具而非直接 console
- 避免使用 var，优先使用 const

**CSS**:
- 使用模块化组织（按功能拆分文件）
- 使用 CSS Variables 定义主题变量
- 类名使用短横线命名（kebab-case）
- 避免使用 !important

**提交规范**:
- 提交信息使用中文或英文，清晰描述改动
- 格式：`类型: 简短描述`
- 类型：feat（新功能）、fix（修复）、refactor（重构）、docs（文档）、style（样式）、test（测试）

## 🏗️ 架构设计

### 模块化设计

项目采用模块化架构，职责清晰分离：

- **core/**: 核心业务逻辑（LRC 解析、音频播放）
- **ui/**: UI 组件（Tab 切换、讲解加载、课程导航、设置面板、快捷键）
- **utils/**: 通用工具（事件系统、语言切换、日志、本地存储、Toast、焦点管理、iOS 优化、屏幕常亮管理）

### 事件驱动

使用 EventEmitter 实现组件间通信，避免紧耦合。

### CSS 模块化

样式文件按功能拆分：
- **base.css**: CSS 变量、基础重置、工具类
- **components.css**: 所有组件样式
- **layout.css**: 页面布局
- **responsive.css**: 响应式适配

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

### LanguageSwitcher

统一的语言切换管理器：

```javascript
import { LanguageSwitcher } from './utils/language-switcher.js';

const switcher = new LanguageSwitcher();
switcher.init();
switcher.initButtons('[data-mode]');
```

**主要方法**：
- `getLang()`: 获取当前语言模式
- `setLang(lang)`: 设置语言模式
- `applyLang(lang)`: 应用到页面
- `initButtons(selector)`: 初始化按钮
- `initMobileSelect(selectId, buttonSelector)`: 初始化移动端选择器

### Logger

统一的日志工具，区分开发和生产环境：

```javascript
import { Logger } from './utils/logger.js';

Logger.info('信息日志');    // 仅开发环境
Logger.warn('警告日志');    // 开发+生产
Logger.error('错误日志');   // 开发+生产
Logger.debug('调试日志');   // 仅开发环境
```

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
5. 使用 Logger 而非 console
6. 测试功能是否正常
7. 运行 ESLint 检查
8. 提交 Pull Request

### 示例：添加新的 UI 组件

```javascript
// src/js/ui/my-component.js
import { Logger } from '../utils/logger.js';

/**
 * 我的组件
 */
export class MyComponent {
  constructor() {
    this.init();
  }

  init() {
    try {
      // 初始化逻辑
      Logger.info('MyComponent 初始化成功');
    } catch (error) {
      Logger.error('MyComponent 初始化失败:', error);
    }
  }
}
```

### 示例：添加新的 CSS 模块

如果需要添加大量新样式，考虑创建新的 CSS 模块：

```css
/* src/css/my-module.css */

/* 我的模块样式 */
.my-component {
  padding: var(--space-md);
  background: var(--card);
  border-radius: var(--radius);
}
```

然后在 `styles.css` 中导入：

```css
@import './my-module.css';
```

## 🐛 调试技巧

### 开发者工具

- 使用浏览器开发者工具的 Console 查看日志
- 使用 Network 面板检查资源加载
- 使用 Application 面板查看 LocalStorage
- 使用 Sources 面板设置断点调试

### Logger 使用

开发环境会显示所有日志，生产环境只显示 warn 和 error：

```javascript
Logger.debug('调试信息');  // 仅开发环境
Logger.info('普通信息');   // 仅开发环境
Logger.warn('警告信息');   // 开发+生产
Logger.error('错误信息');  // 开发+生产
```

### 常见开发问题

1. **音频不播放**：检查浏览器自动播放策略，移动端需要用户交互后才能播放。听写模式已优化，点击"开始听写"按钮即可自动解锁音频。
2. **样式不生效**：检查 CSS Variables 是否正确，确保 styles.css 正确导入了所有模块
3. **路径 404**：检查 `vite.config.js` 中的 `base` 配置是否为 `/nce/`
4. **ESLint 错误**：确保使用 `.eslintrc.cjs` 而非 `.eslintrc.js`（避免 ES 模块冲突）
5. **模块导入失败**：检查文件路径和导出语法，确保使用 `.js` 扩展名
6. **热重载不工作**：检查文件是否在 `src/` 目录下，重启开发服务器
7. **Markdown 不显示**：检查 Vite 中间件插件是否正确配置
8. **播放速度重置**：已修复，切换课程时会自动恢复用户设置的播放速度

## 🧪 测试清单

### 核心功能
- [ ] 课文播放、句子高亮、语言切换、快捷键
- [ ] 播放速度保持（切换课程/自动续播）
- [ ] 卡片学习、浏览模式、默写稿、听写练习
- [ ] 移动端音频自动播放（点击开始按钮）
- [ ] 历史记录进入听写功能
- [ ] 屏幕常亮（手机端播放时）

### 响应式
- [ ] PC/iPad/手机布局正常
- [ ] iOS Safari 兼容性正常

### 浏览器
Chrome/Edge/Firefox/Safari (最新版) | iOS Safari (iOS 14+)

## 📦 构建和部署

### 构建配置

项目使用 Vite 构建，配置文件：`vite.config.js`

**重要配置**：
- `base`: 部署路径（默认 `/nce/`）
- `publicDir`: 静态资源目录
- `outDir`: 输出目录
- `plugins`: 自定义插件（Markdown 加载器）

### 部署

详细部署说明请查看 [DEPLOY.md](DEPLOY.md)

## 🤝 贡献流程

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### Pull Request 检查清单

- [ ] 代码遵循项目规范
- [ ] 通过 ESLint 检查
- [ ] 功能测试通过
- [ ] 添加了必要的注释
- [ ] 更新了相关文档

## 📞 获取帮助

如有问题，请：
- 查看 [README.md](README.md)
- 查看 [DEPLOY.md](DEPLOY.md)
- 提交 GitHub Issue

## 📄 许可证

MIT License
