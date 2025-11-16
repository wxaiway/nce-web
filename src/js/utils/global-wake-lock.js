import { WakeLockManager } from './wake-lock-manager.js';
import { Logger } from './logger.js';

/**
 * 全局屏幕常亮管理器
 * 单例模式,在所有页面共享
 *
 * 功能:
 * 1. 在所有页面显示小太阳图标 (仅手机端)
 * 2. 点击图标切换常亮开关
 * 3. 页面级管理: 进入页面时根据用户设置启用,离开时释放
 * 4. 设置持久化到 localStorage
 */
class GlobalWakeLock {
  constructor() {
    // 单例模式
    if (GlobalWakeLock.instance) {
      return GlobalWakeLock.instance;
    }

    this.manager = new WakeLockManager();
    this.iconElement = null;
    this.buttonElement = null;
    this.initialized = false; // 防止重复初始化

    GlobalWakeLock.instance = this;
  }

  /**
   * 初始化 (在每个页面调用)
   */
  async init() {
    // 防止重复初始化
    if (this.initialized) {
      Logger.info('全局屏幕常亮已初始化，跳过重复调用');
      return;
    }

    // 只在手机端初始化
    if (!WakeLockManager.isMobile()) {
      Logger.info('PC端,跳过屏幕常亮初始化');
      return;
    }

    // 查找或创建工具栏
    this.buttonElement = document.getElementById('globalWakeLockBtn');

    if (!this.buttonElement) {
      this.createToolbar();
    } else {
      this.iconElement = document.getElementById('globalWakeLockIcon');
    }

    // 绑定点击事件
    this.buttonElement.addEventListener('click', () => {
      this.toggle();
    });

    // 如果用户之前启用了常亮，立即尝试获取 wake lock
    if (this.manager.getUserEnabled()) {
      await this.manager.enable();
    }

    // 更新图标状态
    this.updateIcon();

    // 标记已初始化
    this.initialized = true;

    Logger.info('全局屏幕常亮已初始化');
  }

  /**
   * 创建全局工具栏
   */
  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'global-wake-lock-toolbar';
    toolbar.innerHTML = `
      <button id="globalWakeLockBtn" class="wake-lock-btn" title="屏幕常亮">
        <span id="globalWakeLockIcon">🔆</span>
      </button>
    `;
    document.body.appendChild(toolbar);

    this.iconElement = document.getElementById('globalWakeLockIcon');
    this.buttonElement = document.getElementById('globalWakeLockBtn');
  }

  /**
   * 切换常亮开关
   */
  async toggle() {
    const currentState = this.manager.getUserEnabled();
    const newState = !currentState;

    this.manager.setUserEnabled(newState);

    Logger.info('屏幕常亮切换:', newState ? '开启' : '关闭');

    // 立即应用
    if (newState) {
      await this.manager.enable();
    } else {
      this.manager.disable();
    }

    this.updateIcon();
  }

  /**
   * 更新图标状态
   */
  updateIcon() {
    if (!this.buttonElement || !this.iconElement) return;

    const status = this.manager.getStatus();

    // 统一使用 isEnabled 状态（实际是否获取了 wake lock）
    if (status.isEnabled) {
      // 开启状态：实心太阳 + 蓝色背景 + 脉冲动画
      this.iconElement.textContent = '☀️';
      this.buttonElement.classList.add('active');
      this.buttonElement.title = '屏幕常亮: 开启\n点击关闭';
    } else {
      // 关闭状态：空心太阳 + 默认样式
      this.iconElement.textContent = '🔆';
      this.buttonElement.classList.remove('active');
      this.buttonElement.title = '屏幕常亮: 关闭\n点击开启';
    }
  }


  /**
   * 获取管理器实例
   */
  getManager() {
    return this.manager;
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return this.manager.getStatus();
  }
}

// 创建并导出单例
const globalWakeLock = new GlobalWakeLock();

export { globalWakeLock };
