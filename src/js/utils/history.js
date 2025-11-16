import { Storage } from './storage.js';
import { Logger } from './logger.js';

/**
 * 历史记录管理类
 */
export class HistoryManager {
  constructor() {
    this.storageKey = 'vocabulary_recent_history';
    this.maxRecords = 30; // 最多保存30条记录
  }

  /**
   * 添加历史记录
   * @param {Object} record - 记录对象
   * @returns {Object} 添加的记录
   */
  addRecord(record) {
    try {
      // 验证必需字段
      if (!record.type || !record.config) {
        Logger.error('历史记录缺少必需字段:', record);
        return null;
      }

      // 创建完整的记录对象
      const fullRecord = {
        id: record.id || Date.now(),
        type: record.type,
        config: record.config,
        wordCount: record.wordCount || 0,
        createdAt: record.createdAt || Date.now(),
        status: record.status || 'started',
        ...record
      };

      // 获取现有记录
      const history = this.getHistory();

      // 添加到开头
      history.unshift(fullRecord);

      // 限制数量
      if (history.length > this.maxRecords) {
        history.splice(this.maxRecords);
      }

      // 保存
      Storage.set(this.storageKey, history);
      Logger.info('添加历史记录:', fullRecord);

      return fullRecord;
    } catch (error) {
      Logger.error('添加历史记录失败:', error);
      return null;
    }
  }

  /**
   * 更新历史记录
   * @param {number} id - 记录ID
   * @param {Object} updates - 更新的字段
   * @returns {boolean} 是否成功
   */
  updateRecord(id, updates) {
    try {
      const history = this.getHistory();
      const index = history.findIndex(record => record.id === id);

      if (index === -1) {
        Logger.warn('未找到记录:', id);
        return false;
      }

      // 更新记录
      history[index] = {
        ...history[index],
        ...updates,
        updatedAt: Date.now()
      };

      // 保存
      Storage.set(this.storageKey, history);
      Logger.info('更新历史记录:', history[index]);

      return true;
    } catch (error) {
      Logger.error('更新历史记录失败:', error);
      return false;
    }
  }

  /**
   * 删除历史记录
   * @param {number} id - 记录ID
   * @returns {boolean} 是否成功
   */
  deleteRecord(id) {
    try {
      const history = this.getHistory();
      const filtered = history.filter(record => record.id !== id);

      if (filtered.length === history.length) {
        Logger.warn('未找到要删除的记录:', id);
        return false;
      }

      Storage.set(this.storageKey, filtered);
      Logger.info('删除历史记录:', id);

      return true;
    } catch (error) {
      Logger.error('删除历史记录失败:', error);
      return false;
    }
  }

  /**
   * 获取所有历史记录
   * @returns {Array} 历史记录数组
   */
  getHistory() {
    try {
      const history = Storage.get(this.storageKey);
      return Array.isArray(history) ? history : [];
    } catch (error) {
      Logger.error('获取历史记录失败:', error);
      return [];
    }
  }

  /**
   * 获取指定类型的历史记录
   * @param {string} type - 记录类型
   * @returns {Array} 过滤后的历史记录
   */
  getHistoryByType(type) {
    const history = this.getHistory();
    return history.filter(record => record.type === type);
  }

  /**
   * 获取最近N条记录
   * @param {number} limit - 数量限制
   * @returns {Array} 历史记录数组
   */
  getRecentHistory(limit = 12) {
    const history = this.getHistory();
    return history.slice(0, limit);
  }

  /**
   * 清空所有历史记录
   * @returns {boolean} 是否成功
   */
  clearHistory() {
    try {
      Storage.remove(this.storageKey);
      Logger.info('清空历史记录');
      return true;
    } catch (error) {
      Logger.error('清空历史记录失败:', error);
      return false;
    }
  }

  /**
   * 获取记录类型配置
   * @param {string} type - 记录类型
   * @returns {Object} 类型配置
   */
  getTypeConfig(type) {
    const configs = {
      learning: {
        icon: '📖',
        label: '学习模式',
        color: '#0a84ff',
        bgColor: 'rgba(10, 132, 255, 0.05)'
      },
      browse: {
        icon: '👀',
        label: '浏览模式',
        color: '#34c759',
        bgColor: 'rgba(52, 199, 89, 0.05)'
      },
      printable: {
        icon: '📝',
        label: '默写稿',
        color: '#ff9500',
        bgColor: 'rgba(255, 149, 0, 0.05)'
      },
      dictation: {
        icon: '🎯',
        label: '听写练习',
        color: '#ff3b30',
        bgColor: 'rgba(255, 59, 48, 0.05)'
      },
      flashcard: {
        icon: '📖',
        label: '翻转卡学习',
        color: '#5856d6',
        bgColor: 'rgba(88, 86, 214, 0.05)'
      }
    };

    return configs[type] || {
      icon: '📚',
      label: '未知类型',
      color: '#8e8e93',
      bgColor: 'rgba(142, 142, 147, 0.05)'
    };
  }

  /**
   * 格式化相对时间
   * @param {number} timestamp - 时间戳
   * @returns {string} 格式化的时间字符串
   */
  formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;

    if (diff < minute) {
      return '刚刚';
    } else if (diff < hour) {
      const minutes = Math.floor(diff / minute);
      return `${minutes}分钟前`;
    } else if (diff < day) {
      const hours = Math.floor(diff / hour);
      return `${hours}小时前`;
    } else if (diff < week) {
      const days = Math.floor(diff / day);
      return days === 1 ? '昨天' : `${days}天前`;
    } else if (diff < month) {
      const weeks = Math.floor(diff / week);
      return `${weeks}周前`;
    } else {
      const months = Math.floor(diff / month);
      return `${months}个月前`;
    }
  }

  /**
   * 格式化配置摘要
   * @param {Object} config - 配置对象
   * @returns {string} 配置摘要字符串
   */
  formatConfigSummary(config) {
    const parts = [];

    // 册数和课程范围
    if (config.book) {
      parts.push(config.book);
    }
    if (config.startLesson && config.endLesson) {
      parts.push(`L${config.startLesson}-${config.endLesson}`);
    }

    return parts.join(' · ');
  }

  /**
   * 格式化统计信息
   * @param {Object} record - 记录对象
   * @returns {string} 统计信息字符串
   */
  formatStats(record) {
    const parts = [];

    // 单词数量
    if (record.wordCount) {
      parts.push(`${record.wordCount}个单词`);
    }

    // 根据类型添加特定信息
    switch (record.type) {
      case 'learning':
        if (record.config.studyMode === 'random') {
          parts.push('随机排列');
        } else if (record.config.studyMode === 'pos') {
          parts.push('按词性');
        } else {
          parts.push('顺序排列');
        }
        break;

      case 'printable':
        if (record.config.copyCount) {
          const count = record.config.copyCount.toString().replace('custom:', '');
          parts.push(`${count}份`);
        }
        break;

      case 'dictation':
        if (record.result && record.result.accuracy !== undefined) {
          parts.push(`正确率 ${record.result.accuracy}%`);
        }
        break;

      case 'flashcard':
        if (record.result && record.result.accuracy !== undefined) {
          parts.push(`掌握率 ${record.result.accuracy}%`);
        }
        if (record.config.studyMode === 'random') {
          parts.push('随机');
        } else if (record.config.studyMode === 'pos') {
          parts.push('按词性');
        }
        break;
    }

    return parts.join(' · ');
  }
}

// 导出单例
export const historyManager = new HistoryManager();
