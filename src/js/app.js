import { Storage } from './utils/storage.js';

/**
 * 全局应用控制
 * 负责语言切换等全局功能
 */
class App {
  constructor() {
    this.LANG_KEY = 'nce_lang_mode';
    this.init();
  }

  init() {
    // 应用保存的语言模式
    const savedLang = this.getLang();
    this.applyLang(savedLang);

    // 初始化语言切换按钮
    this.initLangTabs();
  }

  /**
   * 获取当前语言模式
   */
  getLang() {
    const lang = Storage.get(this.LANG_KEY, 'bi');
    return ['en', 'bi', 'cn'].includes(lang) ? lang : 'bi';
  }

  /**
   * 设置语言模式
   */
  setLang(lang) {
    Storage.set(this.LANG_KEY, lang);
    this.applyLang(lang);
  }

  /**
   * 应用语言模式到页面
   */
  applyLang(lang) {
    document.body.classList.remove('lang-en', 'lang-bi', 'lang-cn');
    document.body.classList.add(`lang-${lang}`);
  }

  /**
   * 初始化语言切换按钮
   */
  initLangTabs() {
    const tabs = document.querySelectorAll('[data-mode]');
    const currentLang = this.getLang();

    // 初始化时设置正确的激活状态（互斥选择）
    tabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === currentLang);
    });

    // 点击切换
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        this.setLang(mode);

        // 更新按钮状态（互斥选择）
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
      });
    });
  }
}

// 启动全局应用
new App();
