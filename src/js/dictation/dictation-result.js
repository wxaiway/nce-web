import { Logger } from '../utils/logger.js';
import { historyManager } from '../utils/history.js';

/**
 * 听写结果页
 * 注意: 这是结果展示页，不需要屏幕常亮功能
 */
class DictationResultApp {
  constructor() {
    this.data = null;
    this.currentFilter = 'all';
    this.init();
  }

  init() {

    // 加载数据
    this.loadData();

    if (!this.data || !this.data.answers) {
      alert('未找到结果数据');
      location.href = 'vocabulary.html';
      return;
    }

    // 更新历史记录
    this.updateHistory();

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
    const data = sessionStorage.getItem('dictation_result');
    if (data) {
      this.data = JSON.parse(data);
      Logger.info('加载结果数据:', this.data);
    }
  }

  /**
   * 创建历史记录
   */
  updateHistory() {
    if (!this.data || !this.data.answers) {
      Logger.warn('无法创建历史记录：缺少数据');
      return;
    }

    // 如果是查看历史记录（标记为 isFromHistory），则不再创建新记录
    if (this.data.isFromHistory) {
      Logger.info('查看历史记录，跳过创建新记录');
      return;
    }

    // 计算统计信息
    const correctCount = this.data.answers.filter(a => a.isCorrect).length;
    const wrongCount = this.data.answers.filter(a => !a.isCorrect).length;
    const accuracy = Math.round((correctCount / this.data.answers.length) * 100);

    // 计算时长
    const duration = this.data.completedAt && this.data.startedAt ?
      Math.round((this.data.completedAt - this.data.startedAt) / 1000) : 0;

    // 创建完整的历史记录
    historyManager.addRecord({
      type: 'dictation',
      config: this.data.config,
      result: {
        totalWords: this.data.answers.length,
        correctCount: correctCount,
        wrongCount: wrongCount,
        accuracy: accuracy,
        duration: duration,
        // 保存完整的答题记录
        answers: this.data.answers.map(answer => ({
          word: answer.word,
          userAnswer: answer.userAnswer,
          isCorrect: answer.isCorrect,
          meaning: answer.meaning || '',
          pos: answer.pos || '',
          phonetic: answer.phonetic || ''
        }))
      },
      completedAt: this.data.completedAt || Date.now(),
      createdAt: Date.now()
    });

    Logger.info('历史记录已创建');
  }

  /**
   * 渲染页面头部
   */
  renderHeader() {
    const config = this.data.config;
    const title = `${config.book} L${config.startLesson}-${config.endLesson} - 听写结果`;
    document.getElementById('resultTitle').textContent = title;
  }

  /**
   * 渲染总体统计
   */
  renderSummary() {
    const stats = this.data.stats;

    document.getElementById('correctCount').textContent = stats.correct || 0;
    document.getElementById('wrongCount').textContent = stats.wrong || 0;
    document.getElementById('accuracy').textContent = `${stats.accuracy || 0}%`;
    document.getElementById('totalCount').textContent = stats.total || 0;

    const duration = stats.duration || 0;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    document.getElementById('duration').textContent = `${minutes}分${seconds}秒`;

    // 显示复习错词按钮
    if (stats.wrong > 0) {
      document.getElementById('reviewWrongBtn').style.display = 'inline-block';
    }
  }

  /**
   * 渲染结果列表
   */
  renderResults() {
    const container = document.getElementById('resultList');
    const answers = this.getFilteredAnswers();

    if (answers.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: var(--space-xxl); color: var(--muted);">
          没有符合条件的结果
        </div>
      `;
      return;
    }

    container.innerHTML = answers.map((answer, index) => {
      const phoneticText = answer.phonetic && answer.phonetic.length > 0
        ? `[${answer.phonetic.join(', ')}]`
        : '';

      const statusIcon = answer.isCorrect ? '✓' : '✗';
      const statusClass = answer.isCorrect ? 'correct' : 'wrong';

      return `
        <div class="result-item ${statusClass}">
          <div class="result-item-header">
            <div class="result-item-number">第 ${this.getOriginalIndex(answer) + 1} 个单词</div>
            <div class="result-item-status">${statusIcon}</div>
          </div>

          <div class="result-item-word">${this.escapeHtml(answer.word)}</div>

          ${phoneticText ? `<div class="result-item-phonetic">${this.escapeHtml(phoneticText)}</div>` : ''}

          <div class="result-item-info">
            ${answer.pos ? `<span class="result-item-pos">${this.escapeHtml(answer.pos)}</span>` : ''}
            <span class="result-item-meaning">${this.escapeHtml(answer.meaning)}</span>
          </div>

          <div class="result-item-answer">
            <span class="result-item-answer-label">你的答案:</span>
            <span class="result-item-answer-value ${statusClass}">
              ${answer.userAnswer || '(未填写)'}
            </span>
          </div>

          ${!answer.isCorrect ? `
            <div class="result-item-correct-answer">
              正确答案: ${this.escapeHtml(answer.word)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * 获取筛选后的答案
   */
  getFilteredAnswers() {
    if (this.currentFilter === 'all') {
      return this.data.answers;
    } else if (this.currentFilter === 'correct') {
      return this.data.answers.filter(a => a.isCorrect);
    } else if (this.currentFilter === 'wrong') {
      return this.data.answers.filter(a => !a.isCorrect);
    }
    return this.data.answers;
  }

  /**
   * 获取原始索引
   */
  getOriginalIndex(answer) {
    return this.data.answers.findIndex(a => a.word === answer.word);
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

    // 重新听写按钮
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
    const wrongWords = this.data.answers
      .filter(a => !a.isCorrect)
      .map(a => ({
        word: a.word,
        meaning: a.meaning,
        pos: a.pos,
        phonetic: a.phonetic
      }));

    if (wrongWords.length === 0) {
      alert('没有错误的单词！');
      return;
    }

    const newData = {
      mode: this.data.mode,
      config: this.data.config,
      words: wrongWords,
      totalCount: wrongWords.length,
      generatedAt: Date.now(),
      isFromHistory: true  // 标记为查看历史记录
    };

    sessionStorage.setItem('dictation_data', JSON.stringify(newData));

    if (this.data.mode === 'offline') {
      location.href = 'dictation-play.html';
    } else {
      location.href = 'dictation-practice.html';
    }
  }

  /**
   * 重新听写
   */
  restart() {
    const newData = {
      mode: this.data.mode,
      config: this.data.config,
      words: this.data.words,
      totalCount: this.data.words.length,
      generatedAt: Date.now(),
      isFromHistory: true  // 标记为查看历史记录
    };

    sessionStorage.setItem('dictation_data', JSON.stringify(newData));

    if (this.data.mode === 'offline') {
      location.href = 'dictation-play.html';
    } else {
      location.href = 'dictation-practice.html';
    }
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
new DictationResultApp();
