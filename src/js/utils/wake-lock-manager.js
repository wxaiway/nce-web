import { Storage } from './storage.js';
import { Toast } from './toast.js';
import { Logger } from './logger.js';

/**
 * 屏幕唤醒锁管理器（仅手机端）
 */
export class WakeLockManager {
  constructor() {
    this.wakeLock = null;
    this.isEnabled = false;
    this.userEnabled = Storage.get('keepScreenOn', true); // 默认开启
    this.visibilityListenerSetup = false; // 标记是否已设置监听器
  }

  /**
   * 检测是否为移动设备
   */
  static isMobile() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  /**
   * 检测是否支持 Wake Lock API
   */
  static isSupported() {
    return 'wakeLock' in navigator;
  }

  /**
   * 启用屏幕常亮
   */
  async enable() {
    // 仅手机端生效
    if (!WakeLockManager.isMobile()) {
      return false;
    }

    // 检查用户是否启用
    if (!this.userEnabled) {
      return false;
    }

    // 已经启用
    if (this.isEnabled) {
      return true;
    }

    // 检查是否支持 Wake Lock API
    if (!WakeLockManager.isSupported()) {
      // 不支持，显示提示（仅首次）
      if (!Storage.get('wakeLockToastShown', false)) {
        Toast.info('你的设备不支持自动保持屏幕常亮，请在系统设置中调整屏幕休眠时间', 5000);
        Storage.set('wakeLockToastShown', true);
      }
      return false;
    }

    // 请求屏幕唤醒锁
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.isEnabled = true;

      // 监听释放事件
      this.wakeLock.addEventListener('release', () => {
        this.isEnabled = false;
      });

      // 监听页面可见性变化
      this.setupVisibilityListener();

      return true;
    } catch (err) {
      Logger.error('Wake Lock 请求失败:', err);
      return false;
    }
  }

  /**
   * 禁用屏幕常亮
   */
  disable() {
    if (!this.isEnabled) return;

    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }

    this.isEnabled = false;
  }

  /**
   * 设置用户偏好
   */
  setUserEnabled(enabled) {
    this.userEnabled = enabled;
    Storage.set('keepScreenOn', enabled);

    // 如果禁用，立即释放锁
    if (!enabled) {
      this.disable();
    }
  }

  /**
   * 获取用户偏好
   */
  getUserEnabled() {
    return this.userEnabled;
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      userEnabled: this.userEnabled,
      isSupported: WakeLockManager.isSupported(),
      isMobile: WakeLockManager.isMobile(),
    };
  }

  /**
   * 监听页面可见性变化，重新获取锁
   */
  setupVisibilityListener() {
    // 避免重复注册监听器
    if (this.visibilityListenerSetup) return;
    this.visibilityListenerSetup = true;

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && this.userEnabled) {
        // 页面重新可见时，如果锁已释放，重新获取
        if (this.wakeLock && this.wakeLock.released) {
          try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.isEnabled = true;
          } catch (err) {
            Logger.error('重新获取 Wake Lock 失败:', err);
          }
        }
      }
    });
  }
}
