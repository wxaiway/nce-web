import { LRCParser } from './core/lrc-parser.js';
import { AudioPlayer } from './core/audio-player.js';
import { SettingsPanel } from './ui/settings-panel.js';
import { ShortcutManager } from './ui/shortcuts.js';
import { LessonTabs } from './ui/lesson-tabs.js';
import { LessonNotes } from './ui/lesson-notes.js';
import { LessonNavigation } from './ui/lesson-navigation.js';
import { LanguageSwitcher } from './utils/language-switcher.js';
import { Logger } from './utils/logger.js';
import { Storage } from './utils/storage.js';
import { IOSHelper } from './utils/ios-helper.js';
import { Toast } from './utils/toast.js';
import { WakeLockManager } from './utils/wake-lock-manager.js';
import { marked } from 'marked';

// 配置 marked.js 安全选项
marked.setOptions({
  breaks: true,        // 支持 GFM 换行
  gfm: true,          // 启用 GitHub Flavored Markdown
  headerIds: true,    // 为标题生成 ID
  mangle: false,      // 不混淆邮箱地址
});

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
    this.tabs = null; // Tab 管理器
    this.notes = null; // 讲解管理器
    this.navigation = null; // 导航管理器
    this.wakeLockManager = new WakeLockManager(); // 屏幕唤醒锁管理器
    this.init();
  }

  async init() {
    try {
      // 显示加载提示
      this.showLoading();

      // 初始化音频播放器（只做一次）
      const audio = document.getElementById('player');

      // 恢复音量设置
      const savedVolume = Storage.get('audioVolume');
      if (savedVolume !== null) {
        audio.volume = savedVolume;
      }

      this.player = new AudioPlayer(audio, []);

      // 设置事件监听（只做一次）
      this.setupPlayerEvents();

      // 初始化 UI 组件（只做一次）
      this.settingsPanel = new SettingsPanel(this.player, this.wakeLockManager);
      new ShortcutManager(this.player);

      // 初始化移动端控制按钮
      this.setupMobileControls();

      // 初始化 Tab 管理器
      this.tabs = new LessonTabs();

      // 初始化语言切换
      const languageSwitcher = new LanguageSwitcher();
      languageSwitcher.init();
      languageSwitcher.initButtons('#languageSwitcher button');
      languageSwitcher.initMobileSelect('mobileLanguageSelect', '#languageSwitcher button');

      // iOS 优化（只做一次）
      IOSHelper.unlockAudio(audio);
      IOSHelper.optimizeTouchEvents();

      // 加载第一个课程
      await this.loadLesson();

      // 检查自动播放
      this.checkAutoPlay();
    } catch (error) {
      Logger.error('初始化失败:', error);
      this.hideLoading();
      this.showError('页面加载失败，请刷新重试');
    }
  }

  /**
   * 加载课程（可重复调用，用于切换课程）
   * @param {string} book - 书籍名称（可选，不传则从URL解析）
   * @param {string} filename - 课程文件名（可选，不传则从URL解析）
   */
  async loadLesson(book, filename) {
    try {
      // 显示加载提示
      this.showLoading();

      // 解析 URL（如果没传参数）
      if (!book || !filename) {
        const parsed = this.parseHash();
        book = parsed.book;
        filename = parsed.filename;
      }

      if (!book || !filename) {
        window.location.href = 'index.html';
        return;
      }

      // 清理旧状态
      this.cleanup();

      // 加载 LRC
      const lrcText = await this.fetchText(`${book}/${filename}.lrc`);
      const { meta, items } = LRCParser.parse(lrcText);

      this.items = items;
      this.lessonKey = `${book}/${filename}`;

      // 设置页面标题
      this.setTitle(meta, filename);

      // 更新音频源
      this.player.audio.src = `${book}/${filename}.mp3`;

      // 更新播放器数据
      this.player.updateItems(items);

      // 渲染句子列表
      this.renderSentences();

      // 设置返回按钮
      this.setupBackButton(book);

      // 更新课程导航
      if (!this.navigation) {
        this.navigation = new LessonNavigation(book, filename);
        await this.navigation.setupNavigation();
      } else {
        this.navigation.book = book;
        this.navigation.filename = filename;
        await this.navigation.setupNavigation();
      }

      // 更新讲解内容
      if (!this.notes) {
        this.notes = new LessonNotes(this.lessonKey);
      } else {
        this.notes.lessonKey = this.lessonKey;
        this.notes.notesLoaded = false;
      }

      // Tab 切换回调：加载讲解内容
      this.tabs.onTabChange = (tab) => {
        if (tab === 'notes' && !this.notes.isLoaded()) {
          this.notes.loadNotes();
        }
      };

      // 切换到课文 Tab
      this.tabs.switchTab('text');

      // 恢复学习进度
      this.restoreProgress();

      // 更新 URL（不刷新页面）
      if (location.hash !== `#${book}/${filename}`) {
        location.hash = `${book}/${filename}`;
      }

      // 音频加载完成后隐藏 loading（组合方案：兼容移动端 Safari）
      this.setupLoadingHide(this.player.audio);
    } catch (error) {
      Logger.error('加载课程失败:', error);
      this.hideLoading();
      this.showError('课程加载失败，请重试');
      throw error;
    }
  }

  /**
   * 清理旧状态（切换课程前调用）
   */
  cleanup() {
    // 停止播放
    if (this.player) {
      this.player.pause();
      this.player.reset();
    }

    // 清理定时器
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }

    // 重置会话时间
    this.sessionStartTime = Date.now();
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

    // 播放器重置 - 清除 UI 高亮
    this.player.on('playerreset', () => {
      document.querySelectorAll('.sentence.active').forEach((el) => {
        el.classList.remove('active');
      });
    });

    // 状态清理 - 清除 UI 高亮
    this.player.on('statecleared', () => {
      document.querySelectorAll('.sentence.active').forEach((el) => {
        el.classList.remove('active');
      });
    });

    // 音量变化 - 保存设置
    const audio = this.player.audio;
    audio.addEventListener('volumechange', () => {
      Storage.set('audioVolume', audio.volume);
    });

    // 播放时启用屏幕常亮
    this.player.on('play', () => {
      this.wakeLockManager.enable().then(() => {
        // 更新图标
        if (this.settingsPanel) {
          this.settingsPanel.updateWakeLockIcon();
        }
      });
    });

    // 暂停时禁用屏幕常亮
    this.player.on('pause', () => {
      this.wakeLockManager.disable();
      // 更新图标
      if (this.settingsPanel) {
        this.settingsPanel.updateWakeLockIcon();
      }
    });

    // 播放结束时禁用屏幕常亮
    audio.addEventListener('ended', () => {
      this.wakeLockManager.disable();
      // 更新图标
      if (this.settingsPanel) {
        this.settingsPanel.updateWakeLockIcon();
      }
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

    // 直接设置 href，利用浏览器原生导航
    const fallback = `index.html#${book}`;
    backLink.href = fallback;
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
          // 不刷新页面，直接加载下一课
          this.loadLesson(book, nextLesson.filename).then(() => {
            // 加载完成后自动播放第一句
            // 延迟一下确保音频加载完成
            setTimeout(() => {
              this.player.playSegment(0);
            }, 500);
          }).catch((error) => {
            Logger.error('加载下一课失败:', error);
            Toast.error('加载下一课失败，请手动切换', 3000);
          });
        }
      };
      showCountdown();
    } catch (error) {
      Logger.error('自动续播失败:', error);
      Toast.error('自动续播失败', 3000);
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
        // 只恢复 UI 显示，不设置播放器状态
        // 避免 seek 冲突和状态不一致问题
        this.highlightSentence(progress.idx, false);
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
