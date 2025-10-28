/**
 * Tab 切换管理器
 */
export class LessonTabs {
  constructor() {
    this.currentTab = 'text';
    this.onTabChange = null; // 回调函数
    this.init();
  }

  init() {
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);

        // 更新按钮状态
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  /**
   * 切换 Tab
   * @param {string} tab - Tab 名称 ('text' | 'notes')
   */
  switchTab(tab) {
    this.currentTab = tab;

    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      if (btn.dataset.tab === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 切换内容
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });
    document.getElementById(`tab-${tab}`).classList.add('active');

    // 显示/隐藏语言切换和移动端控制栏
    const languageSwitcher = document.getElementById('languageSwitcher');
    const mobileControls = document.getElementById('mobileControls');

    if (tab === 'text') {
      // 课文 Tab：显示语言切换和移动端控制栏
      languageSwitcher?.classList.remove('hidden');
      mobileControls?.classList.remove('hidden');
    } else if (tab === 'notes') {
      // 讲解 Tab：隐藏语言切换和移动端控制栏
      languageSwitcher?.classList.add('hidden');
      mobileControls?.classList.add('hidden');
    }

    // 触发回调
    if (this.onTabChange) {
      this.onTabChange(tab);
    }
  }

  /**
   * 获取当前 Tab
   * @returns {string}
   */
  getCurrentTab() {
    return this.currentTab;
  }
}
