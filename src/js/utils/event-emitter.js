/**
 * 简单的事件发射器
 * 用于组件间通信
 */
export class EventEmitter {
  constructor() {
    this._events = new Map();
  }

  /**
   * 订阅事件
   * @param {string} event - 事件名
   * @param {Function} handler - 处理函数
   * @returns {Function} 取消订阅函数
   */
  on(event, handler) {
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    this._events.get(event).add(handler);

    // 返回取消订阅函数
    return () => this.off(event, handler);
  }

  /**
   * 取消订阅
   */
  off(event, handler) {
    if (this._events.has(event)) {
      this._events.get(event).delete(handler);
    }
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    if (this._events.has(event)) {
      this._events.get(event).forEach((handler) => handler(data));
    }
  }

  /**
   * 订阅一次
   */
  once(event, handler) {
    const wrapper = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}
