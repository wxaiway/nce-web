import { Logger } from '../utils/logger.js';
import { globalWakeLock } from '../utils/global-wake-lock.js';

/**
 * 答案录入页（线下模式）
 */
class DictationInputApp {
  constructor() {
    this.data = null;
    this.answers = [];
    this.init();
  }

  init() {
    // 初始化全局屏幕常亮
    globalWakeLock.init();

    // 加载数据
    this.loadData();

    if (!this.data || this.data.words.length === 0) {
      alert('未找到听写数据');
      location.href = 'vocabulary.html';
      return;
    }

    // 渲染界面
    this.renderHeader();
    this.renderInputList();
    this.bindEvents();
  }

  /**
   * 加载数据
   */
  loadData() {
    const data = sessionStorage.getItem('dictation_input_data');
    if (data) {
      this.data = JSON.parse(data);
      Logger.info('加载录入数据:', this.data);
    }
  }

  /**
   * 渲染页面头部
   */
  renderHeader() {
    const config = this.data.config;
    const title = `${config.book} L${config.startLesson}-${config.endLesson} - 答案录入`;
    document.getElementById('inputTitle').textContent = title;
    document.getElementById('progressText').textContent = `0/${this.data.words.length}`;
  }

  /**
   * 渲染录入列表
   */
  renderInputList() {
    const container = document.getElementById('inputList');

    container.innerHTML = this.data.words.map((word, index) => {
      const hints = [];
      if (word.pos) hints.push(word.pos);
      if (word.meaning) hints.push(word.meaning);

      return `
        <div class="input-item">
          <div class="input-item-number">第 ${index + 1} 个单词</div>
          <div class="input-item-content">
            <div class="input-item-hints">
              ${hints.map(hint => `<span class="input-item-hint">${this.escapeHtml(hint)}</span>`).join('')}
            </div>
            <input
              type="text"
              class="input-item-input"
              data-index="${index}"
              placeholder="输入单词"
              autocomplete="off"
              spellcheck="false"
            />
          </div>
          <div class="input-item-status" data-status="${index}"></div>
        </div>
      `;
    }).join('');

    // 绑定输入事件
    const inputs = container.querySelectorAll('.input-item-input');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.validateInput(input);
        this.updateProgress();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const index = parseInt(input.dataset.index);
          if (index < inputs.length - 1) {
            inputs[index + 1].focus();
          } else {
            this.submit();
          }
        }
      });
    });

    // 聚焦第一个输入框
    if (inputs.length > 0) {
      inputs[0].focus();
    }
  }

  /**
   * 验证输入
   */
  validateInput(input) {
    const index = parseInt(input.dataset.index);
    const word = this.data.words[index];
    const userInput = input.value.trim().toLowerCase();
    const statusElement = document.querySelector(`[data-status="${index}"]`);

    if (!userInput) {
      statusElement.textContent = '';
      return;
    }

    const correct = userInput === word.word.toLowerCase();
    statusElement.textContent = correct ? '✓' : '✗';
    statusElement.style.color = correct ? '#34c759' : '#ff3b30';
  }

  /**
   * 更新进度
   */
  updateProgress() {
    const inputs = document.querySelectorAll('.input-item-input');
    const filled = Array.from(inputs).filter(input => input.value.trim()).length;
    document.getElementById('progressText').textContent = `${filled}/${this.data.words.length}`;
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 返回按钮
    document.getElementById('backBtn').addEventListener('click', () => {
      if (confirm('确定要返回吗？已录入的答案将丢失。')) {
        location.href = 'vocabulary.html';
      }
    });

    // 提交按钮
    document.getElementById('submitBtn').addEventListener('click', () => {
      this.submit();
    });

    // 取消按钮
    document.getElementById('cancelBtn').addEventListener('click', () => {
      if (confirm('确定要取消吗？已录入的答案将丢失。')) {
        location.href = 'vocabulary.html';
      }
    });
  }

  /**
   * 提交答案
   */
  submit() {
    // 收集答案
    const inputs = document.querySelectorAll('.input-item-input');
    this.answers = Array.from(inputs).map((input, index) => {
      const word = this.data.words[index];
      const userAnswer = input.value.trim();
      const isCorrect = userAnswer.toLowerCase() === word.word.toLowerCase();

      return {
        word: word.word,
        meaning: word.meaning,
        pos: word.pos,
        phonetic: word.phonetic,
        userAnswer: userAnswer,  // 统一使用 userAnswer
        isCorrect: isCorrect      // 统一使用 isCorrect
      };
    });

    // 计算统计
    const stats = this.calculateStats();

    // 保存历史记录
    this.saveHistory(stats);

    // 跳转到结果页
    location.href = 'dictation-result.html';
  }

  /**
   * 计算统计
   */
  calculateStats() {
    const total = this.answers.length;
    const correct = this.answers.filter(a => a.isCorrect).length;
    const wrong = total - correct;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    // 从历史记录中获取时长
    const history = JSON.parse(localStorage.getItem('dictation_history_offline') || '[]');
    const record = history.find(h => h.id === this.data.id);
    const duration = record ? record.duration : 0;

    return { total, correct, wrong, accuracy, duration };
  }

  /**
   * 保存历史记录
   */
  saveHistory(stats) {
    // 准备结果数据 (与在线听写格式一致)
    const resultData = {
      config: this.data.config,
      answers: this.answers,
      stats: stats,
      mode: 'offline',
      words: this.data.words,
      startedAt: this.data.generatedAt,
      completedAt: Date.now()
    };

    // 保存到 sessionStorage 用于查看结果
    sessionStorage.setItem('dictation_result', JSON.stringify(resultData));
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
new DictationInputApp();
