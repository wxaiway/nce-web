/**
 * iOS 兼容性工具
 */
export class IOSHelper {
  /**
   * 检测是否为 iOS 设备
   */
  static isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  /**
   * 检测是否为 Safari 浏览器
   */
  static isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }

  /**
   * 音频解锁
   * iOS 需要用户交互才能播放音频
   */
  static unlockAudio(audioElement) {
    if (!this.isIOS()) return;

    let unlocked = false;

    const unlock = () => {
      if (unlocked) return;

      // 播放静音音频解锁
      audioElement.volume = 0;
      audioElement.play().then(() => {
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.volume = 1;
        unlocked = true;

        // 移除事件监听
        document.removeEventListener('touchstart', unlock);
        document.removeEventListener('click', unlock);
      });
    };

    // 监听首次用户交互
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
  }

  /**
   * 优化触摸体验
   */
  static optimizeTouchEvents() {
    if (!this.isIOS()) return;

    // 防止双击缩放
    document.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // 防止长按选择文本
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.sentence')) {
        e.preventDefault();
      }
    });
  }
}
