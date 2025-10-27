/**
 * 统一日志工具
 * 区分开发和生产环境
 */

const isDev = import.meta.env.DEV;

export const Logger = {
  /**
   * 信息日志（仅开发环境）
   * @param {...any} args - 日志参数
   */
  info(...args) {
    if (isDev) {
      console.log('[INFO]', ...args);
    }
  },

  /**
   * 警告日志（开发和生产环境都显示）
   * @param {...any} args - 日志参数
   */
  warn(...args) {
    console.warn('[WARN]', ...args);
  },

  /**
   * 错误日志（开发和生产环境都显示）
   * @param {...any} args - 日志参数
   */
  error(...args) {
    console.error('[ERROR]', ...args);
  },

  /**
   * 调试日志（仅开发环境）
   * @param {...any} args - 日志参数
   */
  debug(...args) {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },
};
