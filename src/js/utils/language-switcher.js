import { Storage } from './storage.js';

/**
 * 语言切换管理器
 * 统一管理全局语言切换功能
 */
export class LanguageSwitcher {
  constructor() {
    this.LANG_KEY = 'nce_lang_mode';
  }

  /**
   * 获取当前语言模式
   * @returns {string} 'en' | 'bi' | 'cn'
   */
  getLang() {
    const lang = Storage.get(this.LANG_KEY, 'bi');
    return ['en', 'bi', 'cn'].includes(lang) ? lang : 'bi';
  }

  /**
   * 设置语言模式
   * @param {string} lang - 语言模式
   */
  setLang(lang) {
    if (!['en', 'bi', 'cn'].includes(lang)) {
      console.warn(`Invalid language mode: ${lang}`);
      return;
    }
    Storage.set(this.LANG_KEY, lang);
    this.applyLang(lang);
  }

  /**
   * 应用语言模式到页面
   * @param {string} lang - 语言模式
   */
  applyLang(lang) {
    document.body.classList.remove('lang-en', 'lang-bi', 'lang-cn');
    document.body.classList.add(`lang-${lang}`);
  }

  /**
   * 初始化语言切换按钮
   * @param {string} selector - 按钮选择器（默认 '[data-mode]'）
   */
  initButtons(selector = '[data-mode]') {
    const buttons = document.querySelectorAll(selector);
    const currentLang = this.getLang();

    // 初始化时设置正确的激活状态
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === currentLang);
    });

    // 点击切换
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.setLang(mode);

        // 更新按钮状态
        buttons.forEach((b) => b.classList.toggle('active', b === btn));
      });
    });
  }

  /**
   * 初始化移动端语言选择器
   * @param {string} selectId - select 元素 ID
   * @param {string} buttonSelector - PC 端按钮选择器
   */
  initMobileSelect(selectId, buttonSelector = '[data-mode]') {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentLang = this.getLang();
    select.value = currentLang;

    select.addEventListener('change', () => {
      const mode = select.value;
      this.setLang(mode);

      // 同步 PC 端按钮
      const buttons = document.querySelectorAll(buttonSelector);
      buttons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
    });
  }

  /**
   * 初始化（应用保存的语言模式）
   */
  init() {
    const savedLang = this.getLang();
    this.applyLang(savedLang);
  }
}
