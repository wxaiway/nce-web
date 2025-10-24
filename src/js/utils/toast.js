/**
 * Toast 通知工具
 * 简单的用户反馈系统
 */
export class Toast {
  /**
   * 显示通知
   * @param {string} message - 消息内容
   * @param {string} type - 类型: success, info, warning, error
   * @param {number} duration - 显示时长（毫秒）
   */
  static show(message, type = 'info', duration = 2000) {
    // 创建 toast 元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // 添加到页面
    document.body.appendChild(toast);

    // 触发显示动画
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // 自动隐藏
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * 显示成功消息
   */
  static success(message, duration) {
    this.show(message, 'success', duration);
  }

  /**
   * 显示信息消息
   */
  static info(message, duration) {
    this.show(message, 'info', duration);
  }

  /**
   * 显示警告消息
   */
  static warning(message, duration) {
    this.show(message, 'warning', duration);
  }

  /**
   * 显示错误消息
   */
  static error(message, duration) {
    this.show(message, 'error', duration);
  }
}
