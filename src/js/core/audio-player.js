import { EventEmitter } from '../utils/event-emitter.js';
import { Storage } from '../utils/storage.js';

/**
 * 音频播放器
 * 负责音频播放控制和句子同步
 */
export class AudioPlayer extends EventEmitter {
  constructor(audioElement, items) {
    super();
    this.audio = audioElement;
    this.items = items;
    this.currentIdx = -1;
    this.segmentEnd = 0;
    this.segmentTimer = null;
    this.isManualPlay = false; // 标记是否为手动播放
    this.isStateTransitioning = false; // 状态转换锁，防止并发更新

    // 读取用户设置
    this.readMode = Storage.get('readMode', 'continuous'); // 'continuous' | 'single'
    this.loopMode = Storage.get('loopMode', 'none'); // 'none' | 'single' | 'all'

    this.setupListeners();
    this.adjustLastSentenceEnd();
  }

  /**
   * 设置事件监听
   */
  setupListeners() {
    // 时间更新 - 检测句子切换
    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());

    // 播放结束
    this.audio.addEventListener('ended', () => this.emit('ended'));

    // 错误处理
    this.audio.addEventListener('error', (e) => {
      const errorMessages = {
        1: '音频加载被中止',
        2: '网络错误，无法加载音频',
        3: '音频解码失败',
        4: '不支持的音频格式',
      };
      const message = errorMessages[this.audio.error?.code] || '音频加载失败';
      this.emit('error', { error: e, message });
    });

    // 播放/暂停事件
    this.audio.addEventListener('play', () => this.scheduleAdvance());
    this.audio.addEventListener('pause', () => this.clearAdvance());
  }

  /**
   * 播放指定句子
   * @param {number} idx - 句子索引
   * @param {boolean} manual - 是否为手动操作
   */
  async playSegment(idx, manual = false) {
    if (idx < 0 || idx >= this.items.length) return;

    // 锁定状态，防止 timeupdate 干扰
    this.isStateTransitioning = true;

    // 清理旧的定时器
    this.clearAdvance();

    this.currentIdx = idx;
    this.isManualPlay = manual;
    const item = this.items[idx];

    // 设置播放位置
    this.audio.currentTime = Math.max(0, item.start);

    // 计算句子结束时间
    this.segmentEnd = this.calculateSegmentEnd(item, idx);

    // 触发句子切换事件（带 manual 参数）
    this.emit('sentencechange', { idx, item, manual });

    // 开始播放
    try {
      await this.audio.play();
      this.emit('play', { idx, item });
      this.scheduleAdvance();
    } catch (error) {
      this.emit('error', { error, message: '播放失败' });
    } finally {
      // 延迟解锁，给 iOS 足够时间同步状态
      setTimeout(() => {
        this.isStateTransitioning = false;
      }, 100);
    }
  }

  /**
   * 计算句子结束时间
   * 点读模式下提前 0.5 秒结束，避免播放到下一句
   */
  calculateSegmentEnd(item, idx) {
    const SINGLE_CUTOFF = 0.5; // 点读模式提前量
    const MIN_DURATION = 0.2; // 最小播放时长

    let baseEnd = item.end || item.start + 1;

    // 点读模式：提前结束
    if (this.readMode === 'single') {
      // 如果有下一句，使用下一句的开始时间作为基准
      if (idx < this.items.length - 1) {
        const nextItem = this.items[idx + 1];
        if (nextItem.start > item.start) {
          baseEnd = Math.min(baseEnd, nextItem.start);
        }
      }

      // 提前 0.5 秒结束，但保证最小播放时长
      const cutoffEnd = baseEnd - SINGLE_CUTOFF;
      return Math.max(item.start + MIN_DURATION, cutoffEnd);
    }

    // 连读模式：正常结束
    return baseEnd;
  }

  /**
   * 暂停播放
   */
  pause() {
    this.audio.pause();
    this.emit('pause', { idx: this.currentIdx });
  }

  /**
   * 设置播放速度
   */
  setPlaybackRate(rate) {
    this.audio.playbackRate = rate;
    this.emit('ratechange', { rate });
  }

  /**
   * 设置读模式
   */
  setReadMode(mode) {
    const oldMode = this.readMode;
    this.readMode = mode;
    Storage.set('readMode', mode);

    // 模式切换时重新计算和调度
    if (oldMode !== mode) {
      // 清理旧的定时器
      this.clearAdvance();

      // 如果正在播放，重新计算 segmentEnd 并调度
      if (!this.audio.paused && this.currentIdx >= 0) {
        const item = this.items[this.currentIdx];
        // 重新计算当前句子的结束时间（基于新模式）
        this.segmentEnd = this.calculateSegmentEnd(item, this.currentIdx);
        // 重新调度自动前进
        this.scheduleAdvance();
      }
    }
  }

  /**
   * 设置循环模式
   */
  setLoopMode(mode) {
    this.loopMode = mode;
    Storage.set('loopMode', mode);
  }

  /**
   * 时间更新处理 - 检测句子切换
   */
  onTimeUpdate() {
    // 状态转换期间跳过自动更新，防止并发冲突
    if (this.isStateTransitioning) {
      return;
    }

    const currentTime = this.audio.currentTime;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const end = item.end || Infinity;

      if (currentTime >= item.start && currentTime < end) {
        if (this.currentIdx !== i) {
          this.currentIdx = i;
          this.segmentEnd = end;
          // 自动播放时 manual=false
          this.emit('sentencechange', { idx: i, item, manual: false });
        }
        break;
      }
    }
  }

  /**
   * 调度自动前进
   */
  scheduleAdvance() {
    this.clearAdvance();

    if (this.audio.paused || this.segmentEnd === 0) return;

    const rate = Math.max(0.1, this.audio.playbackRate || 1);
    const remainingTime = this.segmentEnd - this.audio.currentTime;
    const delay = (remainingTime * 1000) / rate;

    if (delay > 0) {
      this.segmentTimer = setTimeout(() => {
        // 点读模式：播放完当前句就停止
        if (this.readMode === 'single') {
          this.audio.pause();

          // 单句循环：重播当前句
          if (this.loopMode === 'single') {
            setTimeout(() => {
              this.playSegment(this.currentIdx);
            }, 300);
          }
          return;
        }

        // 连读模式：自动播放下一句
        if (this.currentIdx + 1 < this.items.length) {
          this.playSegment(this.currentIdx + 1);
        } else {
          // 播放到最后一句
          this.audio.pause();

          // 整篇循环：回到第一句
          if (this.loopMode === 'all') {
            setTimeout(() => {
              this.playSegment(0);
            }, 500);
          } else {
            // 触发课程结束事件（用于自动续播）
            this.emit('lessonend');
          }
        }
      }, delay);
    }
  }

  /**
   * 清除调度定时器
   */
  clearAdvance() {
    if (this.segmentTimer) {
      clearTimeout(this.segmentTimer);
      this.segmentTimer = null;
    }
  }

  /**
   * 调整最后一句的端点
   * 如果最后一句没有 end 时间，使用音频总时长
   */
  adjustLastSentenceEnd() {
    if (this.items.length === 0) return;

    const adjustEnd = () => {
      const lastItem = this.items[this.items.length - 1];

      // 如果最后一句没有 end 或 end 无效，使用音频总时长
      if (!lastItem.end || lastItem.end <= lastItem.start) {
        const duration = this.audio.duration;
        if (duration && duration > 0) {
          lastItem.end = duration;

          // 如果当前正在播放最后一句，更新 segmentEnd
          if (this.currentIdx === this.items.length - 1) {
            this.segmentEnd = duration;
          }
        }
      }
    };

    // 如果 metadata 已加载，立即调整
    if (this.audio.duration && this.audio.duration > 0) {
      adjustEnd();
    }

    // 监听 loadedmetadata 事件
    this.audio.addEventListener('loadedmetadata', adjustEnd, { once: true });
  }

  /**
   * 更新句子数据（用于切换课程）
   * @param {Array} items - 新的句子数组
   */
  updateItems(items) {
    this.items = items;
    this.currentIdx = -1;
    this.segmentEnd = 0;
    this.adjustLastSentenceEnd();
  }

  /**
   * 重置播放器状态（用于切换课程）
   */
  reset() {
    this.clearAdvance();
    this.currentIdx = -1;
    this.segmentEnd = 0;
    this.isManualPlay = false;
    this.isStateTransitioning = false;
    // 不重置 readMode 和 loopMode（保持用户设置）
  }

  /**
   * 销毁播放器
   */
  destroy() {
    this.clearAdvance();
    this.audio.pause();
    this._events.clear();
  }
}
