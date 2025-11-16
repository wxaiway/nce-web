import { Logger } from '../utils/logger.js';

/**
 * 翻转卡学习结果页
 * 注意: 这是结果展示页，不需要屏幕常亮功能
 */
class FlashcardResultApp {
  constructor() {
    this.data = null;
    this.currentFilter = 'all';
    this.init();
  }

  init() {
    // 加载数据
    this.loadData();

    if (!this.data || !this.data.result) {
      alert('未找到结果数据');
      location.href = 'vocabulary.html';
      return;
    }

    // 渲染界面
    this.renderHeader();
    this.renderSummary();
    this.renderResults();
    this.bindEvents();
  }

  /**
   * 加载数据
   */
  loadData() {
    const data = sessionStorage.getItem('flashcard_result');
    if (data) {
      this.data = JSON.parse(data);
      Logger.info('加载结果数据:', this.data);
    }
  }

  /**
   * 渲染页面头部
   */
  renderHeader() {
    const config = this.data.config;
    const title = `${config.book} L${config.startLesson}-${config.endLesson} - 学习结果`;
    document.getElementById('resultTitle').textContent = title;
  }

  /**
   * 渲染总体统计
   */
  renderSummary() {
    const result = this.data.result;

    document.getElementById('masteredCount').textContent = result.mastered || 0;
    document.getElementById('reviewCount').textContent = result.review || 0;
    document.getElementById('learningCount').textContent = result.learning || 0;
    document.getElementById('totalCount').textContent = result.totalWords || 0;
    document.getElementById('accuracy').textContent = `${result.accuracy || 0}%`;

    const duration = result.duration || 0;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    document.getElementById('duration').textContent = `${minutes}分${seconds}秒`;

    // 显示复习错词按钮
    const wrongCount = (result.review || 0) + (result.learning || 0);
    if (wrongCount > 0) {
      document.getElementById('reviewWrongBtn').style.display = 'inline-block';
    }
  }

  /**
   * 渲染结果列表
   */
  renderResults() {
    const container = document.getElementById('resultList');
    const ratings = this.getFilteredRatings();

    if (ratings.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: var(--space-xxl); color: var(--muted);">
          没有符合条件的结果
        </div>
      `;
      return;
    }

    container.innerHTML = ratings.map((rating, index) => {
      const word = rating.word;
      const phoneticText = word.phonetic && word.phonetic.length > 0
        ? `[${word.phonetic.join(', ')}]`
        : '';

      let statusIcon, statusClass, ratingText;
      if (rating.level === 2) {
        statusIcon = '😊';
        statusClass = 'mastered';
        ratingText = '认识';
      } else if (rating.level === 1) {
        statusIcon = '🤔';
        statusClass = 'review';
        ratingText = '模糊';
      } else {
        statusIcon = '😓';
        statusClass = 'learning';
        ratingText = '不认识';
      }

      return `
        <div class="result-item ${statusClass}">
          <div class="result-item-header">
            <div class="result-item-number">第 ${rating.index + 1} 个单词</div>
            <div class="result-item-status">${statusIcon}</div>
          </div>

          <div class="result-item-word">${this.escapeHtml(word.word)}</div>

          ${phoneticText ? `<div class="result-item-phonetic">${this.escapeHtml(phoneticText)}</div>` : ''}

          <div class="result-item-info">
            ${word.pos ? `<span class="result-item-pos">${this.escapeHtml(word.pos)}</span>` : ''}
            <span class="result-item-meaning">${this.escapeHtml(word.meaning)}</span>
          </div>

          <div class="result-item-rating">
            <span class="result-item-rating-label">评价:</span>
            <span class="result-item-rating-value ${statusClass}">
              ${ratingText}
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 获取筛选后的评价
   */
  getFilteredRatings() {
    const ratings = this.data.result.ratings || [];

    if (this.currentFilter === 'all') {
      return ratings;
    } else if (this.currentFilter === 'mastered') {
      return ratings.filter(r => r.level === 2);
    } else if (this.currentFilter === 'review') {
      return ratings.filter(r => r.level === 1);
    } else if (this.currentFilter === 'learning') {
      return ratings.filter(r => r.level === 0);
    }
    return ratings;
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 返回按钮
    document.getElementById('backBtn').addEventListener('click', () => {
      location.href = 'vocabulary.html';
    });

    // 复习错词按钮
    document.getElementById('reviewWrongBtn')?.addEventListener('click', () => {
      this.reviewWrong();
    });

    // 重新学习按钮
    document.getElementById('restartBtn').addEventListener('click', () => {
      this.restart();
    });

    // 返回配置按钮
    document.getElementById('backToConfigBtn').addEventListener('click', () => {
      location.href = 'vocabulary.html';
    });

    // 筛选标签
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = tab.dataset.filter;
        this.renderResults();
      });
    });
  }

  /**
   * 复习错词
   */
  reviewWrong() {
    const wrongRatings = this.data.result.ratings.filter(r => r.level === 0 || r.level === 1);

    if (wrongRatings.length === 0) {
      alert('没有需要复习的单词');
      return;
    }

    const data = {
      id: Date.now(),
      mode: 'learning',
      config: this.data.config,
      words: wrongRatings.map(r => r.word),
      totalCount: wrongRatings.length,
      generatedAt: Date.now()
    };

    sessionStorage.setItem('flashcard_data', JSON.stringify(data));
    location.href = 'flashcard.html';
  }

  /**
   * 重新学习
   */
  restart() {
    const data = {
      id: Date.now(),
      mode: 'learning',
      config: this.data.config,
      words: this.data.result.ratings.map(r => r.word),
      totalCount: this.data.result.ratings.length,
      generatedAt: Date.now()
    };

    sessionStorage.setItem('flashcard_data', JSON.stringify(data));
    location.href = 'flashcard.html';
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
new FlashcardResultApp();
