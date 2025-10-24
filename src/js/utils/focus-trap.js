/**
 * 焦点陷阱工具
 * 用于模态框和面板，限制焦点在容器内循环
 */
export class FocusTrap {
  /**
   * 激活焦点陷阱
   * @param {HTMLElement} container - 容器元素
   */
  static activate(container) {
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // 聚焦第一个元素
    firstElement.focus();

    // 监听 Tab 键
    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab: 反向循环
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: 正向循环
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTab);

    // 返回清理函数
    return () => {
      container.removeEventListener('keydown', handleTab);
    };
  }
}
