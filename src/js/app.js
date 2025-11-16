import { LanguageSwitcher } from './utils/language-switcher.js';

/**
 * 全局应用控制
 * 负责语言切换等全局功能
 * 注意: 屏幕常亮功能由各学习页面独立管理
 */
class App {
  constructor() {
    this.languageSwitcher = new LanguageSwitcher();
    this.init();
  }

  init() {
    // 应用保存的语言模式
    this.languageSwitcher.init();

    // 初始化语言切换按钮
    this.languageSwitcher.initButtons();
  }
}

// 启动全局应用
new App();
