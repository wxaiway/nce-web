import { Logger } from '../utils/logger.js';
import { globalWakeLock } from '../utils/global-wake-lock.js';
import { historyManager } from '../utils/history.js';

/**
 * 卡片学习页
 */
class FlashcardApp {
  constructor() {
    this.result = null;
    this.words = [];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.stats = {
      mastered: 0,    // 认识
      review: 0,      // 模糊
      learning: 0     // 不认识
    };
    this.wordRatings = []; // 记录每个单词的评价
    this.startTime = Date.now();
    this.audioCache = new Map(); // 缓存音频可用性检测结果
    this.currentAudio = null; // 当前播放的音频对象
    this.init();
  }

  async init() {
    // 初始化全局屏幕常亮
    globalWakeLock.init();

    // 页面卸载时释放常亮
    window.addEventListener('beforeunload', () => {
      globalWakeLock.getManager().disable();
    });

    // 加载数据
    this.loadData();

    if (!this.result || this.words.length === 0) {
      alert('未找到学习数据');
      location.href = 'vocabulary.html';
      return;
    }

    // 应用学习模式
    this.applyStudyMode();

    // 渲染界面
    this.renderCard();
    this.updateProgress();

    // 绑定事件
    this.bindEvents();

    // 预加载所有音频检查
    await this.preloadAudioChecks();

    // 预加载完成后启用常亮（如果用户开启了设置）
    if (globalWakeLock.getManager().getUserEnabled()) {
      await globalWakeLock.getManager().enable();
      globalWakeLock.updateIcon();
    }
  }

  /**
   * 加载数据
   */
  loadData() {
    const data = sessionStorage.getItem('flashcard_data');
    if (data) {
      this.result = JSON.parse(data);
      this.words = this.result.words || [];
      Logger.info('加载学习数据:', this.result);
    }
  }

  /**
   * 应用学习模式
   */
  applyStudyMode() {
    const mode = this.result.config.studyMode;

    if (mode === 'random') {
      // 随机打乱
      for (let i = this.words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.words[i], this.words[j]] = [this.words[j], this.words[i]];
      }
    }
  }

  /**
   * 预加载所有音频检查
   */
  async preloadAudioChecks() {
    const book = this.result.config.book.toLowerCase();
    const baseUrl = import.meta.env.BASE_URL;

    Logger.info('开始预加载音频检查...');

    // 批量检查所有单词的音频
    const checkPromises = this.words.map(async (word) => {
      const usAudioUrl = `${baseUrl}words/${book}/${word.word}_a.mp3`;
      const ukAudioUrl = `${baseUrl}words/${book}/${word.word}_e.mp3`;

      // 并行检查美音和英音
      await Promise.all([
        this.checkAudioExists(usAudioUrl),
        this.checkAudioExists(ukAudioUrl)
      ]);
    });

    // 等待所有检查完成
    await Promise.all(checkPromises);

    Logger.info('音频检查预加载完成，共检查', this.words.length, '个单词');
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 返回按钮
    document.getElementById('backBtn').addEventListener('click', () => {
      if (confirm('确定要退出学习吗？进度将不会保存。')) {
        location.href = 'vocabulary.html';
      }
    });

    // 退出按钮
    document.getElementById('exitBtn').addEventListener('click', () => {
      if (confirm('确定要退出学习吗？进度将不会保存。')) {
        location.href = 'vocabulary.html';
      }
    });

    // 显示答案按钮
    document.getElementById('showAnswerBtn').addEventListener('click', () => {
      this.flipCard();
    });

    // 音频播放按钮
    document.getElementById('playUsBtn').addEventListener('click', () => {
      const word = this.words[this.currentIndex];
      const book = this.result.config.book.toLowerCase();
      const baseUrl = import.meta.env.BASE_URL;
      const url = `${baseUrl}words/${book}/${word.word}_a.mp3`;
      this.playAudio(url);
    });

    document.getElementById('playUkBtn').addEventListener('click', () => {
      const word = this.words[this.currentIndex];
      const book = this.result.config.book.toLowerCase();
      const baseUrl = import.meta.env.BASE_URL;
      const url = `${baseUrl}words/${book}/${word.word}_e.mp3`;
      this.playAudio(url);
    });

    // 评价按钮
    document.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const level = parseInt(btn.dataset.level);
        this.rateWord(level);
      });
    });

    // 完成界面按钮
    document.getElementById('reviewWrongBtn')?.addEventListener('click', () => {
      this.reviewWrong();
    });

    document.getElementById('restartBtn')?.addEventListener('click', () => {
      this.restart();
    });

    document.getElementById('backToConfigBtn')?.addEventListener('click', () => {
      location.href = 'vocabulary.html';
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (!this.isFlipped) {
          this.flipCard();
        }
      } else if (e.key === '1' && this.isFlipped) {
        this.rateWord(2); // 认识
      } else if (e.key === '2' && this.isFlipped) {
        this.rateWord(1); // 模糊
      } else if (e.key === '3' && this.isFlipped) {
        this.rateWord(0); // 不认识
      } else if (e.key === 'Escape') {
        if (confirm('确定要退出学习吗？进度将不会保存。')) {
          location.href = 'vocabulary.html';
        }
      }
    });
  }

  /**
   * 渲染卡片
   */
  renderCard() {
    if (this.currentIndex >= this.words.length) {
      this.showCompletion();
      return;
    }

    const word = this.words[this.currentIndex];

    // 更新标题
    document.getElementById('flashcardTitle').textContent =
      `${this.result.config.book} L${parseInt(this.result.config.startLesson)}-${parseInt(this.result.config.endLesson)}`;

    // 更新正面（中文）
    document.getElementById('wordMeaning').textContent = word.meaning;
    document.getElementById('wordPos').textContent = word.pos || '';

    // 更新背面（英文）
    document.getElementById('wordText').textContent = word.word;
    document.getElementById('wordPhonetic').textContent =
      word.phonetic.length > 0 ? `[${word.phonetic.join(', ')}]` : '';
    document.getElementById('wordPosBack').textContent =
      `${word.pos || ''} ${word.meaning}`;

    // 更新音频按钮
    this.updateAudioButtons(word);

    // 重置卡片状态
    this.isFlipped = false;
    document.getElementById('flashcard').classList.remove('flipped');
    document.getElementById('ratingButtons').style.display = 'none';
  }

  /**
   * 更新音频播放按钮
   */
  async updateAudioButtons(word) {
    const playUsBtn = document.getElementById('playUsBtn');
    const playUkBtn = document.getElementById('playUkBtn');
    const book = this.result.config.book.toLowerCase();

    // 使用 import.meta.env.BASE_URL 获取正确的基础路径
    const baseUrl = import.meta.env.BASE_URL;

    // 检查美音
    const usAudioUrl = `${baseUrl}words/${book}/${word.word}_a.mp3`;
    const hasUsAudio = await this.checkAudioExists(usAudioUrl);
    playUsBtn.style.display = hasUsAudio ? 'inline-flex' : 'none';

    // 检查英音
    const ukAudioUrl = `${baseUrl}words/${book}/${word.word}_e.mp3`;
    const hasUkAudio = await this.checkAudioExists(ukAudioUrl);
    playUkBtn.style.display = hasUkAudio ? 'inline-flex' : 'none';
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
   * 翻转卡片
   */
  flipCard() {
    if (this.isFlipped) return;

    this.isFlipped = true;
    document.getElementById('flashcard').classList.add('flipped');

    // 显示评价按钮
    setTimeout(() => {
      document.getElementById('ratingButtons').style.display = 'flex';
    }, 300);
  }

  /**
   * 评价单词
   */
  rateWord(level) {
    // 记录当前单词的评价
    const currentWord = this.words[this.currentIndex];
    this.wordRatings.push({
      word: currentWord,
      level: level,
      index: this.currentIndex
    });

    // 更新统计
    if (level === 2) {
      this.stats.mastered++;
    } else if (level === 1) {
      this.stats.review++;
    } else {
      this.stats.learning++;
    }

    // 下一张卡片
    this.currentIndex++;
    this.renderCard();
    this.updateProgress();
  }

  /**
   * 更新进度
   */
  updateProgress() {
    const total = this.words.length;
    const current = this.currentIndex + 1;  // 从 1 开始计数
    const percentage = ((current - 1) / total) * 100;  // 进度条基于已完成数量

    // 更新进度条
    document.getElementById('progressFill').style.width = `${percentage}%`;

    // 更新进度文本
    document.getElementById('progressText').textContent = `${current}/${total}`;

    // 更新统计
    document.getElementById('masteredCount').textContent = this.stats.mastered;
    document.getElementById('reviewCount').textContent = this.stats.review + this.stats.learning;
  }

  /**
   * 显示完成界面
   */
  showCompletion() {
    const endTime = Date.now();
    const duration = Math.floor((endTime - this.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    // 更新统计
    document.getElementById('finalMastered').textContent = this.stats.mastered;
    document.getElementById('finalReview').textContent = this.stats.review;
    document.getElementById('finalLearning').textContent = this.stats.learning;
    document.getElementById('studyTime').textContent = `${minutes}分${seconds}秒`;

    // 显示复习错题按钮（如果有错题）
    if (this.stats.review + this.stats.learning > 0) {
      document.getElementById('reviewWrongBtn').style.display = 'block';
    }

    // 保存历史记录
    this.saveHistory(duration);

    // 显示完成界面
    document.getElementById('completionScreen').style.display = 'flex';
  }

  /**
   * 复习错题
   */
  reviewWrong() {
    // 筛选出需要复习的单词（模糊 + 不认识）
    const wrongWords = this.wordRatings
      .filter(rating => rating.level === 0 || rating.level === 1)
      .map(rating => rating.word);

    if (wrongWords.length === 0) {
      alert('没有需要复习的单词');
      return;
    }

    // 重置状态
    this.words = wrongWords;
    this.currentIndex = 0;
    this.wordRatings = []; // 清空评价记录
    this.stats = { mastered: 0, review: 0, learning: 0 };
    this.startTime = Date.now();

    // 隐藏完成界面
    document.getElementById('completionScreen').style.display = 'none';

    // 重新开始
    this.renderCard();
    this.updateProgress();
  }

  /**
   * 重新学习
   */
  restart() {
    // 重置状态
    this.currentIndex = 0;
    this.wordRatings = []; // 清空评价记录
    this.stats = { mastered: 0, review: 0, learning: 0 };
    this.startTime = Date.now();

    // 重新应用学习模式
    this.applyStudyMode();

    // 隐藏完成界面
    document.getElementById('completionScreen').style.display = 'none';

    // 重新开始
    this.renderCard();
    this.updateProgress();
  }

  /**
   * 保存历史记录
   */
  saveHistory(duration) {
    const total = this.wordRatings.length;
    const accuracy = total > 0 ? Math.round((this.stats.mastered / total) * 100) : 0;

    const record = {
      id: this.result.id || Date.now(),
      type: 'flashcard',
      config: this.result.config,
      result: {
        totalWords: total,
        mastered: this.stats.mastered,
        review: this.stats.review,
        learning: this.stats.learning,
        accuracy: accuracy,
        duration: duration,
        ratings: this.wordRatings
      },
      wordCount: total,
      createdAt: this.result.generatedAt || Date.now(),
      completedAt: Date.now()
    };

    // 保存到统一的历史记录管理器
    historyManager.addRecord(record);

    // 同时保存到 sessionStorage 用于查看详情
    sessionStorage.setItem('flashcard_result', JSON.stringify(record));

    Logger.info('翻转卡学习记录已保存:', record);
  }
}

// 启动应用
new FlashcardApp();
