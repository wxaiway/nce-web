/**
 * 本地存储工具
 * 统一管理 localStorage 操作
 */
export class Storage {
  /**
   * 获取存储值
   */
  static get(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * 设置存储值
   */
  static set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 删除存储值
   */
  static remove(key) {
    localStorage.removeItem(key);
  }

  /**
   * 清空所有存储
   */
  static clear() {
    localStorage.clear();
  }
}
