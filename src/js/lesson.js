import { LRCParser } from './core/lrc-parser.js';
import { AudioPlayer } from './core/audio-player.js';
import { SettingsPanel } from './ui/settings-panel.js';
import { ShortcutManager } from './ui/shortcuts.js';
import { Storage } from './utils/storage.js';
import { IOSHelper } from './utils/ios-helper.js';
import { Toast } from './utils/toast.js';

/**
 * 课文页面主应用
 */
class LessonApp {
  constructor() {
    this.player = null;
    this.items = [];
    this.lessonKey = ''; // 当前课程标识 (book/filename)
    this.scrollTimer = null; // 滚动定时器
    this.sessionStartTime = Date.now(); // 会话开始时间
    this.init();
  }

  async init() {
    try {
      // 显示加载提示
      this.showLoading();

      // 解析 URL
      const { book, filename } = this.parseHash();
      if (!book || !filename) {
        window.location.href = 'index.html';
        return;
      }

      // 加载 LRC
      const lrcText = await this.fetchText(`${book}/${filename}.lrc`);
      const { meta, items } = LRCParser.parse(lrcText);

      this.items = items;
      this.lessonKey = `${book}/${filename}`;

      // 设置页面标题
      this.setTitle(meta, filename);

      // 初始化音频播放器
      const audio = document.getElementById('player');
      audio.src = `${book}/${filename}.mp3`;

      // 恢复音量设置
      const savedVolume = Storage.get('audioVolume');
      if (savedVolume !== null) {
        audio.volume = savedVolume;
      }

      this.player = new AudioPlayer(audio, items);

      // 设置事件监听
      this.setupPlayerEvents();

      // 渲染句子列表
      this.renderSentences();

      // 初始化 UI 组件
      new SettingsPanel(this.player);
      new ShortcutManager(this.player);

      // 初始化移动端控制按钮
      this.setupMobileControls();

      // iOS 优化
      IOSHelper.unlockAudio(audio);
      IOSHelper.optimizeTouchEvents();

      // 恢复学习进度
      this.restoreProgress();

      // 检查自动播放
      this.checkAutoPlay();

      // 设置返回按钮
      this.setupBackButton(book);

      // 设置课程导航
      this.setupLessonNavigation();

      // 音频加载完成后隐藏 loading（组合方案：兼容移动端 Safari）
      this.setupLoadingHide(audio);
    } catch (error) {
      console.error('初始化失败:', error);
      this.hideLoading();
      this.showError('页面加载失败，请刷新重试');
    }
  }

  /**
   * 解析 URL hash
   */
  parseHash() {
    const hash = decodeURIComponent(location.hash.slice(1));
    const [book, ...rest] = hash.split('/');
    return { book, filename: rest.join('/') };
  }

  /**
   * 获取文本内容
   */
  async fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${url}`);
    }
    return response.text();
  }

  /**
   * 设置页面标题
   */
  setTitle(meta, filename) {
    const titleEl = document.getElementById('lessonTitle');
    const subEl = document.getElementById('lessonSub');

    if (titleEl) {
      titleEl.textContent = meta.ti || filename;
    }
    if (subEl && meta.al) {
      subEl.textContent = meta.al;
    }
  }

  /**
   * 设置播放器事件
   */
  setupPlayerEvents() {
    // 句子切换 - 高亮当前句
    this.player.on('sentencechange', ({ idx, manual }) => {
      this.highlightSentence(idx, manual);
      this.saveProgress(idx);
    });

    // 课程结束 - 自动续播
    this.player.on('lessonend', () => {
      this.handleLessonEnd();
    });

    // 错误处理
    this.player.on('error', ({ message }) => {
      this.showError(message);
    });

    // 音量变化 - 保存设置
    const audio = this.player.audio;
    audio.addEventListener('volumechange', () => {
      Storage.set('audioVolume', audio.volume);
    });
  }

  /**
   * 渲染句子列表
   */
  renderSentences() {
    const container = document.getElementById('sentences');
    if (!container) return;

    container.innerHTML = this.items
      .map(
        (item, idx) => `
      <div class="sentence" data-idx="${idx}">
        <div class="en">${this.escapeHtml(item.en)}</div>
        ${item.cn ? `<div class="cn">${this.escapeHtml(item.cn)}</div>` : ''}
      </div>
    `
      )
      .join('');

    // 点击句子播放
    container.addEventListener('click', (e) => {
      const sentence = e.target.closest('.sentence');
      if (sentence) {
        const idx = parseInt(sentence.dataset.idx, 10);
        this.player.playSegment(idx, true); // 传递 manual=true
      }
    });
  }

  /**
   * 高亮当前句子
   * @param {number} idx - 句子索引
   * @param {boolean} manual - 是否为手动操作
   */
  highlightSentence(idx, manual = false) {
    // 移除旧高亮
    document.querySelectorAll('.sentence.active').forEach((el) => {
      el.classList.remove('active');
    });

    // 添加新高亮
    const sentence = document.querySelector(`.sentence[data-idx="${idx}"]`);
    if (sentence) {
      sentence.classList.add('active');
      this.scheduleScrollTo(sentence, manual);
    }
  }

  /**
   * 调度滚动到目标元素
   * @param {HTMLElement} element - 目标元素
   * @param {boolean} manual - 是否为手动操作
   */
  scheduleScrollTo(element, manual) {
    if (!element) return;

    // 清除之前的定时器（防抖）
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }

    // 检查是否启用自动跟随
    const autoScroll = Storage.get('autoScroll', true);
    if (!autoScroll) return;

    if (manual) {
      // 手动操作：立即平滑滚动
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // 自动播放：延迟 420ms 后快速滚动
      this.scrollTimer = setTimeout(() => {
        element.scrollIntoView({ behavior: 'auto', block: 'center' });
      }, 420);
    }
  }

  /**
   * 设置返回按钮
   */
  setupBackButton(book) {
    const backLink = document.getElementById('backLink');
    if (!backLink) return;

    const fallback = `index.html#${book}`;
    backLink.href = fallback;

    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      // 始终返回首页并定位到对应书籍
      location.href = fallback;
    });
  }

  /**
   * 设置课程导航
   */
  async setupLessonNavigation() {
    const prevBtn = document.getElementById('prevLesson');
    const nextBtn = document.getElementById('nextLesson');

    if (!prevBtn || !nextBtn) return;

    try {
      const { book, filename } = this.parseHash();
      const response = await fetch(import.meta.env.BASE_URL + 'static/data.json');
      const data = await response.json();
      const bookNum = book.replace('NCE', '');
      const lessons = data[bookNum] || [];

      const currentIndex = lessons.findIndex((l) => l.filename === filename);

      if (currentIndex === -1) {
        prevBtn.hidden = true;
        nextBtn.hidden = true;
        return;
      }

      // 上一课
      if (currentIndex > 0) {
        const prevLesson = lessons[currentIndex - 1];
        prevBtn.href = `lesson.html#${book}/${prevLesson.filename}`;
        prevBtn.hidden = false;
        prevBtn.onclick = (e) => {
          e.preventDefault();
          location.href = `lesson.html#${book}/${prevLesson.filename}`;
          location.reload();
        };
      } else {
        prevBtn.hidden = true;
      }

      // 下一课
      if (currentIndex < lessons.length - 1) {
        const nextLesson = lessons[currentIndex + 1];
        nextBtn.href = `lesson.html#${book}/${nextLesson.filename}`;
        nextBtn.hidden = false;
        nextBtn.onclick = (e) => {
          e.preventDefault();
          location.href = `lesson.html#${book}/${nextLesson.filename}`;
          location.reload();
        };
      } else {
        nextBtn.hidden = true;
      }
    } catch (error) {
      console.error('设置课程导航失败:', error);
      prevBtn.hidden = true;
      nextBtn.hidden = true;
    }
  }

  /**
   * 设置移动端控制按钮
   */
  setupMobileControls() {
    // 重播按钮
    const replayBtn = document.getElementById('replayBtn');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        if (this.player.currentIdx >= 0) {
          this.player.playSegment(this.player.currentIdx);
        }
      });
    }

    // 快退按钮
    const seekBackBtn = document.getElementById('seekBackBtn');
    if (seekBackBtn) {
      seekBackBtn.addEventListener('click', () => {
        this.player.audio.currentTime -= 5;
      });
    }

    // 快进按钮
    const seekForwardBtn = document.getElementById('seekForwardBtn');
    if (seekForwardBtn) {
      seekForwardBtn.addEventListener('click', () => {
        this.player.audio.currentTime += 5;
      });
    }

    // 静音按钮
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        this.player.audio.muted = !this.player.audio.muted;
        // 更新按钮文本
        muteBtn.textContent = this.player.audio.muted ? '🔊 取消静音' : '🔇 静音';
      });
    }
  }

  /**
   * 处理课程结束
   */
  async handleLessonEnd() {
    const autoNext = Storage.get('autoNext', false);
    if (!autoNext) return;

    try {
      // 解析当前课程信息
      const { book, filename } = this.parseHash();

      // 加载课程列表
      const response = await fetch(import.meta.env.BASE_URL + 'static/data.json');
      const data = await response.json();

      // 提取书籍编号（NCE1 -> 1）
      const bookNumber = book.replace('NCE', '');

      // 获取当前书籍的课程列表
      const lessons = data[bookNumber];
      if (!lessons || !Array.isArray(lessons)) return;

      // 找到当前课程的索引
      const currentIndex = lessons.findIndex((lesson) => lesson.filename === filename);

      if (currentIndex === -1) return;

      // 检查是否是最后一课
      if (currentIndex === lessons.length - 1) {
        Toast.success('🎉 恭喜完成本册所有课程！', 3000);
        return;
      }

      // 获取下一课
      const nextLesson = lessons[currentIndex + 1];

      // 显示倒计时
      let countdown = 3;
      const showCountdown = () => {
        if (countdown > 0) {
          Toast.info(`${countdown} 秒后播放: ${nextLesson.title}`, 1000);
          countdown--;
          setTimeout(showCountdown, 1000);
        } else {
          // 跳转到下一课
          sessionStorage.setItem('nce_auto_play', '1');
          location.hash = `${book}/${nextLesson.filename}`;
          location.reload();
        }
      };
      showCountdown();
    } catch (error) {
      console.error('自动续播失败:', error);
    }
  }

  /**
   * 保存学习进度（详细版本）
   */
  saveProgress(idx) {
    const allProgress = Storage.get('lessonProgress', {});
    const currentTime = this.player.audio.currentTime;
    const duration = this.player.audio.duration || 0;
    const studyTime = Math.floor((Date.now() - this.sessionStartTime) / 1000); // 秒

    allProgress[this.lessonKey] = {
      idx,                                    // 当前句子索引
      time: currentTime,                      // 播放时间
      duration,                               // 总时长
      percentage: duration > 0 ? Math.round((idx / this.items.length) * 100) : 0, // 完成百分比
      studyTime,                              // 学习时长（秒）
      lastStudy: Date.now(),                  // 最后学习时间
      timestamp: Date.now(),                  // 兼容旧版本
    };
    Storage.set('lessonProgress', allProgress);
  }

  /**
   * 恢复学习进度
   */
  restoreProgress() {
    const allProgress = Storage.get('lessonProgress', {});
    const progress = allProgress[this.lessonKey];

    if (progress && progress.idx > 0) {
      // 延迟恢复，等待 UI 渲染完成
      setTimeout(() => {
        // 只设置位置和高亮，不触发播放（避免浏览器自动播放限制）
        const item = this.items[progress.idx];
        if (item) {
          this.player.currentIdx = progress.idx;
          this.player.audio.currentTime = item.start;
          this.highlightSentence(progress.idx, false);
        }
      }, 500);
    }
  }

  /**
   * 检查自动播放
   */
  checkAutoPlay() {
    const autoPlay = sessionStorage.getItem('nce_auto_play');
    if (autoPlay === '1') {
      sessionStorage.removeItem('nce_auto_play');
      // 等待音频加载完成后自动播放（组合方案：兼容移动端 Safari）
      this.setupAutoPlay();
    }
  }

  /**
   * 设置自动播放（组合方案：兼容移动端 Safari）
   */
  setupAutoPlay() {
    const audio = this.player.audio;
    let autoPlayTriggered = false;

    const triggerAutoPlay = () => {
      if (autoPlayTriggered) return;
      autoPlayTriggered = true;
      setTimeout(() => {
        this.player.playSegment(0);
      }, 300);
    };

    // 1. 超时兜底（3秒）- 防止永久等待
    const timeout = setTimeout(triggerAutoPlay, 3000);

    // 2. loadedmetadata（元数据加载完成）- 移动端更容易触发
    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      triggerAutoPlay();
    }, { once: true });

    // 3. loadeddata（数据加载完成）- PC端理想情况
    audio.addEventListener('loadeddata', () => {
      clearTimeout(timeout);
      triggerAutoPlay();
    }, { once: true });
  }

  /**
   * 显示加载提示
   */
  showLoading() {
    const loading = document.getElementById('loadingIndicator');
    if (loading) {
      loading.hidden = false;
    }
  }

  /**
   * 隐藏加载提示
   */
  hideLoading() {
    const loading = document.getElementById('loadingIndicator');
    if (loading) {
      loading.hidden = true;
    }
  }

  /**
   * 设置加载提示隐藏逻辑（组合方案：兼容移动端 Safari）
   * 移动端 Safari 不会自动加载音频数据，loadeddata 事件不会触发
   * 使用超时 + loadedmetadata + loadeddata 三重保障
   */
  setupLoadingHide(audio) {
    let loadingHidden = false;
    const hideLoadingOnce = () => {
      if (loadingHidden) return;
      loadingHidden = true;
      this.hideLoading();
    };

    // 1. 超时兜底（3秒）- 防止永久卡住
    const timeout = setTimeout(hideLoadingOnce, 3000);

    // 2. loadedmetadata（元数据加载完成）- 移动端更容易触发
    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      hideLoadingOnce();
    }, { once: true });

    // 3. loadeddata（数据加载完成）- PC端理想情况
    audio.addEventListener('loadeddata', () => {
      clearTimeout(timeout);
      hideLoadingOnce();
    }, { once: true });
  }

  /**
   * 显示错误提示
   */
  showError(message) {
    Toast.error(message, 3000);
  }

  /**
   * HTML 转义
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 启动应用
new LessonApp();
