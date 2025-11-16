import { Logger } from '../utils/logger.js';
import { globalWakeLock } from '../utils/global-wake-lock.js';

/**
 * 单词浏览页面
 */
class BrowseApp {
  constructor() {
    this.result = null;
    this.allWords = [];
    this.filteredWords = [];
    this.audioCache = new Map(); // 缓存音频可用性检测结果
    this.currentAudio = null; // 当前播放的音频对象
    this.init();
  }

  init() {
    // 初始化全局屏幕常亮
    globalWakeLock.init();

    // 加载数据
    this.loadData();

    if (!this.result) {
      alert('未找到数据');
      location.href = 'vocabulary.html';
      return;
    }

    this.allWords = this.result.words;
    this.filteredWords = [...this.allWords];

    // 渲染界面
    this.renderHeader();
    this.renderStats();
    this.renderWords();

    // 绑定事件
    this.bindEvents();
  }

  /**
   * 加载数据
   */
  loadData() {
    const data = sessionStorage.getItem('browse_data');
    if (data) {
      this.result = JSON.parse(data);
      Logger.info('加载浏览数据:', this.result);
    }
  }

  /**
   * 渲染页面头部
   */
  renderHeader() {
    const config = this.result.config;
    const title = `${config.book} L${parseInt(config.startLesson)}-${parseInt(config.endLesson)}`;
    document.getElementById('browseTitle').textContent = title;
  }

  /**
   * 渲染统计信息
   */
  renderStats() {
    const statsText = document.getElementById('statsText');
    statsText.textContent = `共 ${this.filteredWords.length} 个单词`;
  }

  /**
   * 渲染单词列表
   */
  renderWords() {
    const container = document.getElementById('wordGrid');

    if (this.filteredWords.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-text">没有找到匹配的单词</div>
          <div class="empty-state-hint">试试其他搜索条件</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.filteredWords.map((word, index) => {
      const phoneticText = word.phonetic && word.phonetic.length > 0
        ? `[${word.phonetic.join(', ')}]`
        : '';

      return `
        <div class="word-card">
          <div class="word-card-header">
            <div class="word-card-word">${this.escapeHtml(word.word)}</div>
            ${word.pos ? `<div class="word-card-pos">${this.escapeHtml(word.pos)}</div>` : ''}
            <div class="word-card-audio" data-word-index="${index}">
              <button class="audio-btn-small" data-accent="a" title="美音" style="display: none;">
                <span class="audio-icon">🔊</span>
                <span class="audio-label">美</span>
              </button>
              <button class="audio-btn-small" data-accent="e" title="英音" style="display: none;">
                <span class="audio-icon">🔊</span>
                <span class="audio-label">英</span>
              </button>
            </div>
          </div>
          ${phoneticText ? `<div class="word-card-phonetic">${this.escapeHtml(phoneticText)}</div>` : ''}
          <div class="word-card-meaning">${this.escapeHtml(word.meaning)}</div>
        </div>
      `;
    }).join('');

    // 检查并显示音频按钮
    this.updateAllAudioButtons();
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 返回按钮
    document.getElementById('backBtn').addEventListener('click', () => {
      location.href = 'vocabulary.html';
    });

    // 开始学习按钮
    document.getElementById('startLearningBtn').addEventListener('click', () => {
      this.startLearning();
    });

    // 搜索输入
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => {
      this.filterWords();
    });

    // 词性筛选
    const posFilter = document.getElementById('posFilter');
    posFilter.addEventListener('change', () => {
      this.filterWords();
    });
  }

  /**
   * 筛选单词
   */
  filterWords() {
    const searchText = document.getElementById('searchInput').value.toLowerCase().trim();
    const posFilter = document.getElementById('posFilter').value;

    this.filteredWords = this.allWords.filter(word => {
      // 搜索过滤
      let matchSearch = !searchText ||
        word.word.toLowerCase().includes(searchText) ||
        word.meaning.toLowerCase().includes(searchText);

      // 搜索音标（phonetic 是数组）
      if (!matchSearch && searchText && word.phonetic && word.phonetic.length > 0) {
        matchSearch = word.phonetic.some(p => p.toLowerCase().includes(searchText));
      }

      // 词性过滤
      const matchPos = posFilter === 'all' || word.pos === posFilter;

      return matchSearch && matchPos;
    });

    this.renderStats();
    this.renderWords();
  }

  /**
   * 开始学习
   */
  startLearning() {
    // 使用当前筛选的单词进行学习
    const words = this.filteredWords.length > 0 ? this.filteredWords : this.allWords;

    if (words.length === 0) {
      alert('没有可学习的单词');
      return;
    }

    const result = {
      id: Date.now(),
      mode: 'learning',
      config: this.result.config,
      words,
      totalCount: words.length,
      generatedAt: Date.now()
    };

    // 保存到 sessionStorage
    sessionStorage.setItem('flashcard_data', JSON.stringify(result));

    // 跳转到卡片学习页
    location.href = 'flashcard.html';
  }

  /**
   * 更新所有音频按钮
   */
  async updateAllAudioButtons() {
    const baseUrl = import.meta.env.BASE_URL;
    const book = this.result.config.book.toLowerCase();

    // 使用事件委托绑定点击事件
    const container = document.getElementById('wordGrid');
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.audio-btn-small');
      if (btn) {
        const audioContainer = btn.closest('.word-card-audio');
        const wordIndex = parseInt(audioContainer.dataset.wordIndex);
        const accent = btn.dataset.accent;
        const word = this.filteredWords[wordIndex];
        const url = `${baseUrl}words/${book}/${word.word}_${accent}.mp3`;
        this.playAudio(url);
      }
    });

    // 批量检查音频文件存在性
    for (let i = 0; i < this.filteredWords.length; i++) {
      const word = this.filteredWords[i];
      const audioContainer = container.querySelector(`[data-word-index="${i}"]`);
      if (!audioContainer) continue;

      const usBtn = audioContainer.querySelector('[data-accent="a"]');
      const ukBtn = audioContainer.querySelector('[data-accent="e"]');

      // 检查美音
      const usAudioUrl = `${baseUrl}words/${book}/${word.word}_a.mp3`;
      const hasUsAudio = await this.checkAudioExists(usAudioUrl);
      if (usBtn) usBtn.style.display = hasUsAudio ? 'inline-flex' : 'none';

      // 检查英音
      const ukAudioUrl = `${baseUrl}words/${book}/${word.word}_e.mp3`;
      const hasUkAudio = await this.checkAudioExists(ukAudioUrl);
      if (ukBtn) ukBtn.style.display = hasUkAudio ? 'inline-flex' : 'none';
    }
  }

  /**
   * 检查音频文件是否存在
   */
  async checkAudioExists(url) {
    // 检查缓存
    if (this.audioCache.has(url)) {
      return this.audioCache.get(url);
    }

    try {
      const response = await fetch(url, { method: 'HEAD' });
      const exists = response.ok;
      this.audioCache.set(url, exists);
      return exists;
    } catch (error) {
      this.audioCache.set(url, false);
      return false;
    }
  }

  /**
   * 播放音频
   */
  playAudio(url) {
    // 停止当前播放的音频
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    // 创建新的音频对象
    this.currentAudio = new Audio(url);

    this.currentAudio.play().catch(error => {
      Logger.error('音频播放失败:', error);
    });
  }

  /**
   * HTML转义
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 启动应用
new BrowseApp();
