import { Logger } from '../utils/logger.js';
import { globalWakeLock } from '../utils/global-wake-lock.js';

/**
 * 在线听写练习页
 */
class DictationPracticeApp {
  constructor() {
    this.data = null;
    this.currentIndex = 0;
    this.isPaused = false;
    this.startTime = Date.now();
    this.pausedTime = 0;
    this.pauseStartTime = null;
    this.audioElement = new Audio(); // 复用单个 Audio 元素
    this.audioCache = new Map();
    this.countdownTimer = null;
    this.answers = [];
    this.shouldReplay = false; // 标记是否需要重播
    this.remainingTime = 0; // 暂停时剩余的倒计时时间
    this.isWaitingInput = false; // 标记是否正在等待输入
    this.currentResolve = null; // 当前 waitForInput 的 resolve 函数
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

    if (!this.data || this.data.words.length === 0) {
      alert('未找到听写数据');
      location.href = 'vocabulary.html';
      return;
    }

    // 渲染界面
    this.renderHeader();
    this.renderWordList(); // 渲染所有单词卡片
    this.updateProgress();
    this.bindEvents();

    // 预加载所有音频检查
    await this.preloadAudioChecks();

    // 预加载完成后启用常亮（如果用户开启了设置）
    if (globalWakeLock.getManager().getUserEnabled()) {
      await globalWakeLock.getManager().enable();
      globalWakeLock.updateIcon();
    }

    // 不自动开始，等待用户点击"开始听写"按钮
    // 音频解锁将在按钮点击时处理
  }

  /**
   * 加载数据
   */
  loadData() {
    const data = sessionStorage.getItem('dictation_data');
    if (data) {
      this.data = JSON.parse(data);
      Logger.info('加载听写数据:', this.data);
    }
  }

  /**
   * 渲染页面头部
   */
  renderHeader() {
    const config = this.data.config;
    const title = `${config.book} L${config.startLesson}-${config.endLesson}`;
    document.getElementById('practiceTitle').textContent = title;
  }

  /**
   * 渲染单词列表
   */
  renderWordList() {
    const container = document.getElementById('wordList');
    const config = this.data.config;

    container.innerHTML = this.data.words.map((word, index) => {
      const hints = [];
      if (config.showPos && word.pos) hints.push(word.pos);
      if (config.showMeaning && word.meaning) hints.push(word.meaning);

      return `
        <div class="word-card pending" data-index="${index}">
          <div class="word-card-header">
            <span class="word-number">${index + 1}</span>
            <div class="word-hints">
              ${hints.map(hint => `<span class="word-hint">${this.escapeHtml(hint)}</span>`).join(' ')}
            </div>
          </div>
          <input
            type="text"
            class="word-card-input"
            data-index="${index}"
            placeholder="听写单词..."
            autocomplete="off"
            spellcheck="false"
            disabled
          />
          <div class="word-card-footer">
            <span class="word-card-countdown"></span>
            <span class="word-card-status"></span>
          </div>
        </div>
      `;
    }).join('');

    // 绑定输入框事件
    const inputs = container.querySelectorAll('.word-card-input');
    inputs.forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.nextWord();
        }
      });
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

  /**
   * 绑定事件
   */
  bindEvents() {
    // 开始听写按钮
    document.getElementById('startBtn').addEventListener('click', () => {
      Logger.info('开始听写按钮被点击');

      // 隐藏覆盖层
      document.getElementById('startOverlay').classList.add('hidden');
      Logger.info('覆盖层已隐藏');

      // 开始练习
      // 注意: 我们在用户点击的同步上下文中,所以音频可以直接播放
      Logger.info('开始调用 start()');
      this.start();
    });

    // 返回按钮
    document.getElementById('backBtn').addEventListener('click', () => {
      if (confirm('确定要退出听写吗？进度将不会保存。')) {
        location.href = 'vocabulary.html';
      }
    });

    // 暂停按钮
    document.getElementById('pauseBtn').addEventListener('click', () => {
      this.togglePause();
    });

    // 重播按钮
    document.getElementById('replayBtn').addEventListener('click', () => {
      this.replayCurrentWord();
    });

    // 下一个按钮
    document.getElementById('nextBtn').addEventListener('click', () => {
      this.nextWord();
    });

    // 完成界面按钮
    document.getElementById('viewResultBtn')?.addEventListener('click', () => {
      this.viewResult();
    });

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
      // 如果在输入框中，只处理 Enter（Enter 已在 renderWordList 中处理）
      if (e.target.classList.contains('word-card-input')) {
        return;
      }

      // Space: 重播当前单词
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (!this.isPaused) {
          this.replayCurrentWord();
        }
      }
      // ESC: 退出听写
      else if (e.key === 'Escape') {
        if (confirm('确定要退出听写吗？进度将不会保存。')) {
          location.href = 'vocabulary.html';
        }
      }
    });
  }

  /**
   * 预加载所有音频检查
   */
  async preloadAudioChecks() {
    const book = this.data.config.book.toLowerCase();
    const baseUrl = import.meta.env.BASE_URL;
    const accent = this.data.config.accent;

    Logger.info('开始预加载音频检查...');

    // 批量检查所有单词的音频
    const checkPromises = this.data.words.map(async (word) => {
      // 根据配置的发音检查对应的音频
      if (accent === 'random') {
        // 随机模式需要检查两种发音
        const usAudioUrl = `${baseUrl}words/${book}/${word.word}_a.mp3`;
        const ukAudioUrl = `${baseUrl}words/${book}/${word.word}_e.mp3`;
        await Promise.all([
          this.checkAudioExists(usAudioUrl),
          this.checkAudioExists(ukAudioUrl)
        ]);
      } else {
        // 固定发音只检查一种
        const audioUrl = `${baseUrl}words/${book}/${word.word}_${accent}.mp3`;
        await this.checkAudioExists(audioUrl);

        // 如果主发音不存在，检查备用发音
        if (!this.audioCache.get(audioUrl)) {
          const fallbackAccent = accent === 'a' ? 'e' : 'a';
          const fallbackUrl = `${baseUrl}words/${book}/${word.word}_${fallbackAccent}.mp3`;
          await this.checkAudioExists(fallbackUrl);
        }
      }
    });

    // 等待所有检查完成
    await Promise.all(checkPromises);

    Logger.info('音频检查预加载完成，共检查', this.data.words.length, '个单词');
  }

  /**
   * 开始练习
   */
  async start() {
    while (this.currentIndex < this.data.words.length) {
      if (this.isPaused) {
        await this.waitForResume();
      }

      // 等待输入，如果需要重播则重复当前单词
      do {
        this.shouldReplay = false;

        // 播放当前单词
        await this.playCurrentWord();

        // 等待输入
        await this.waitForInput();
      } while (this.shouldReplay);

      this.saveAnswer();
      this.currentIndex++;
      this.updateProgress();
    }

    this.complete();
  }

  /**
   * 播放当前单词
   */
  async playCurrentWord() {
    const word = this.data.words[this.currentIndex];
    const config = this.data.config;

    // 更新界面
    this.updateWordInfo(word);

    // 播放音频
    for (let i = 0; i < config.playCount; i++) {
      // 如果暂停，等待恢复
      if (this.isPaused) {
        await this.waitForResume();
      }

      this.updateStatus(`正在播放第 ${i + 1} 遍...`);
      await this.playAudio(word.word, config.accent);

      if (i < config.playCount - 1) {
        await this.sleep(1000);
      }
    }

    this.updateStatus('请输入听到的单词');
  }

  /**
   * 更新单词卡片状态
   */
  updateWordInfo(word) {
    // 移除所有卡片的 current 类
    document.querySelectorAll('.word-card').forEach(card => {
      card.classList.remove('current');
    });

    // 给当前卡片添加 current 类并启用输入框
    const currentCard = document.querySelector(`.word-card[data-index="${this.currentIndex}"]`);
    if (currentCard) {
      currentCard.classList.remove('pending');
      currentCard.classList.add('current');

      const input = currentCard.querySelector('.word-card-input');
      input.disabled = false;
      input.value = '';
      input.focus();

      // 滚动到当前卡片
      currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 更新按钮状态
    this.updateButtonStates();
  }

  /**
   * 更新按钮状态
   */
  updateButtonStates() {
    const replayBtn = document.getElementById('replayBtn');
    const nextBtn = document.getElementById('nextBtn');

    // 播放中或暂停时禁用重播和下一个按钮，等待输入且未暂停时启用
    const shouldEnable = this.isWaitingInput && !this.isPaused;

    if (replayBtn) {
      replayBtn.disabled = !shouldEnable;
    }
    if (nextBtn) {
      nextBtn.disabled = !shouldEnable;
    }
  }

  /**
   * 更新状态文字
   */
  updateStatus(text) {
    const statusElement = document.getElementById('statusText');
    if (statusElement) {
      statusElement.textContent = text;
    }
  }

  /**
   * 播放音频（复用单个 Audio 元素）
   */
  async playAudio(word, accent) {
    const book = this.data.config.book.toLowerCase();
    const baseUrl = import.meta.env.BASE_URL;

    // 确定发音
    let selectedAccent = accent;
    if (accent === 'random') {
      selectedAccent = Math.random() > 0.5 ? 'a' : 'e';
    }

    let url = `${baseUrl}words/${book}/${word}_${selectedAccent}.mp3`;

    // 检查音频是否存在
    const exists = await this.checkAudioExists(url);
    if (!exists) {
      // 尝试另一个发音
      const fallbackAccent = selectedAccent === 'a' ? 'e' : 'a';
      const fallbackUrl = `${baseUrl}words/${book}/${word}_${fallbackAccent}.mp3`;
      const fallbackExists = await this.checkAudioExists(fallbackUrl);

      if (!fallbackExists) {
        Logger.warn(`音频不存在: ${word}`);
        return;
      }

      url = fallbackUrl;
    }

    return new Promise((resolve) => {
      // 复用同一个 Audio 元素，只改变 src
      this.audioElement.src = url;

      this.audioElement.onended = resolve;
      this.audioElement.onerror = () => {
        Logger.error('音频播放失败:', url);
        resolve();
      };
      this.audioElement.play().catch(error => {
        Logger.error('音频播放失败:', error);
        resolve();
      });
    });
  }

  /**
   * 检查音频文件是否存在
   */
  async checkAudioExists(url) {
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
   * 等待用户输入
   */
  async waitForInput() {
    // 如果已经在等待输入，先清除
    if (this.isWaitingInput) {
      this.clearWaitInput();
    }

    this.isWaitingInput = true;
    this.updateButtonStates(); // 启用重播和下一个按钮

    const interval = this.data.config.interval;
    return new Promise((resolve) => {
      this.currentResolve = resolve;

      // 如果有剩余时间（从暂停恢复），使用剩余时间，否则使用完整间隔
      let remaining = this.remainingTime > 0 ? this.remainingTime : interval;
      this.remainingTime = 0; // 重置剩余时间

      const currentCard = document.querySelector(`.word-card[data-index="${this.currentIndex}"]`);
      const countdownElement = currentCard?.querySelector('.word-card-countdown');

      const updateCountdown = () => {
        if (countdownElement) {
          countdownElement.textContent = `${remaining}秒后自动下一个`;
        }
      };

      updateCountdown();

      this.countdownTimer = setInterval(() => {
        if (this.isPaused) {
          // 暂停时保存剩余时间并清除定时器
          this.remainingTime = remaining;
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
          return;
        }

        remaining--;

        if (remaining <= 0) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
          this.isWaitingInput = false;
          this.currentResolve = null;
          if (countdownElement) {
            countdownElement.textContent = '';
          }
          resolve();
        } else {
          updateCountdown();
        }
      }, 1000);
    });
  }

  /**
   * 清除等待输入状态
   */
  clearWaitInput() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.currentResolve) {
      this.currentResolve();
      this.currentResolve = null;
    }
    this.isWaitingInput = false;
    this.remainingTime = 0;
    this.updateButtonStates(); // 禁用重播和下一个按钮
  }

  /**
   * 保存答案
   */
  saveAnswer() {
    const word = this.data.words[this.currentIndex];
    const currentCard = document.querySelector(`.word-card[data-index="${this.currentIndex}"]`);
    const input = currentCard?.querySelector('.word-card-input');
    const userInput = input?.value.trim().toLowerCase() || '';
    const correct = userInput === word.word.toLowerCase();

    this.answers.push({
      word: word.word,
      meaning: word.meaning,
      pos: word.pos,
      phonetic: word.phonetic,
      userAnswer: userInput,
      isCorrect: correct
    });

    // 更新卡片状态
    if (currentCard) {
      currentCard.classList.remove('current');
      currentCard.classList.add(correct ? 'correct' : 'wrong');

      const statusElement = currentCard.querySelector('.word-card-status');
      if (statusElement) {
        statusElement.textContent = correct ? '✓' : '✗';
      }

      // 如果错误，显示正确答案
      if (!correct) {
        const footer = currentCard.querySelector('.word-card-footer');
        const correctAnswer = document.createElement('div');
        correctAnswer.className = 'word-card-correct-answer';
        correctAnswer.textContent = `正确: ${word.word}`;
        footer.appendChild(correctAnswer);
      }

      // 禁用输入框
      if (input) {
        input.disabled = true;
      }
    }
  }

  /**
   * 重播当前单词
   */
  replayCurrentWord() {
    if (this.isPaused || !this.isWaitingInput) return;

    // 停止当前音频
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }

    // 设置重播标志并清除当前等待
    this.shouldReplay = true;
    this.clearWaitInput();
  }

  /**
   * 下一个单词
   */
  nextWord() {
    if (!this.isWaitingInput) return;

    this.shouldReplay = false;
    this.clearWaitInput();
  }

  /**
   * 暂停/继续
   */
  togglePause() {
    this.isPaused = !this.isPaused;

    const pauseIcon = document.getElementById('pauseIcon');

    if (this.isPaused) {
      if (pauseIcon) pauseIcon.textContent = '▶️';
      this.pauseStartTime = Date.now();

      // 停止音频
      if (this.audioElement) {
        this.audioElement.pause();
      }

      this.updateStatus('已暂停 - 可以继续输入');
    } else {
      if (pauseIcon) pauseIcon.textContent = '⏸️';

      if (this.pauseStartTime) {
        this.pausedTime += Date.now() - this.pauseStartTime;
        this.pauseStartTime = null;
      }

      this.updateStatus('继续练习...');

      // 恢复音频（如果有且被暂停）
      if (this.audioElement && this.audioElement.paused && !this.audioElement.ended) {
        this.audioElement.play().catch(err => {
          Logger.warn('恢复音频播放失败:', err);
        });
      }

      // 恢复倒计时（如果在等待输入阶段且有剩余时间）
      if (this.isWaitingInput && this.remainingTime > 0) {
        this.resumeCountdownAfterPause();
      }
    }

    // 更新按钮状态
    this.updateButtonStates();
  }

  /**
   * 暂停后恢复倒计时
   */
  resumeCountdownAfterPause() {
    const currentCard = document.querySelector(`.word-card[data-index="${this.currentIndex}"]`);
    const countdownElement = currentCard?.querySelector('.word-card-countdown');

    const updateCountdown = () => {
      if (countdownElement) {
        countdownElement.textContent = `${this.remainingTime}秒后自动下一个`;
      }
    };

    updateCountdown();

    this.countdownTimer = setInterval(() => {
      if (this.isPaused) {
        // 再次暂停时清除定时器
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        return;
      }

      this.remainingTime--;

      if (this.remainingTime <= 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.isWaitingInput = false;
        this.remainingTime = 0;
        if (countdownElement) {
          countdownElement.textContent = '';
        }
        // 触发 resolve，让主循环继续
        if (this.currentResolve) {
          this.currentResolve();
          this.currentResolve = null;
        }
      } else {
        updateCountdown();
      }
    }, 1000);
  }

  /**
   * 等待恢复
   */
  waitForResume() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.isPaused) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * 更新进度
   */
  updateProgress() {
    const total = this.data.words.length;
    const current = this.currentIndex + 1;  // 从 1 开始计数
    const percentage = ((current - 1) / total) * 100;  // 进度条基于已完成数量

    // 计算正确和错误数量
    const correctCount = this.answers.filter(a => a.isCorrect).length;
    const wrongCount = this.answers.filter(a => !a.isCorrect).length;

    document.getElementById('progressFill').style.width = `${percentage}%`;
    document.getElementById('correctCount').textContent = correctCount;
    document.getElementById('wrongCount').textContent = wrongCount;
    document.getElementById('progressText').textContent = `${current}/${total}`;

    // 更新已用时间
    const elapsed = Math.floor((Date.now() - this.startTime - this.pausedTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('elapsedTime').textContent = `${minutes}分${seconds}秒`;
  }

  /**
   * 完成练习
   */
  complete() {
    const endTime = Date.now();
    const duration = Math.floor((endTime - this.startTime - this.pausedTime) / 1000);

    // 计算统计
    const stats = this.calculateStats();

    // 更新完成界面
    document.getElementById('finalCorrect').textContent = stats.correct;
    document.getElementById('finalWrong').textContent = stats.wrong;
    document.getElementById('finalAccuracy').textContent = `${stats.accuracy}%`;

    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    document.getElementById('finalTime').textContent = `${minutes}分${seconds}秒`;

    // 显示复习错词按钮
    if (stats.wrong > 0) {
      document.getElementById('reviewWrongBtn').style.display = 'block';
    }

    // 保存历史记录
    this.saveHistory(stats, duration);

    // 显示完成界面
    document.getElementById('completionScreen').style.display = 'flex';
  }

  /**
   * 计算统计
   */
  calculateStats() {
    const total = this.answers.length;
    const correct = this.answers.filter(a => a.isCorrect).length;
    const wrong = total - correct;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { total, correct, wrong, accuracy };
  }

  /**
   * 保存历史记录
   */
  saveHistory(stats, duration) {
    const history = JSON.parse(localStorage.getItem('dictation_history_online') || '[]');

    const record = {
      id: this.data.id,
      mode: 'online',
      config: this.data.config,
      words: this.data.words,
      answers: this.answers,
      stats: {
        ...stats,
        duration: duration
      },
      generatedAt: this.data.generatedAt,
      completedAt: Date.now()
    };

    history.unshift(record);

    // 最多保存50条
    if (history.length > 50) {
      history.pop();
    }

    localStorage.setItem('dictation_history_online', JSON.stringify(history));

    // 同时保存到 sessionStorage 用于查看结果
    sessionStorage.setItem('dictation_result', JSON.stringify(record));
  }

  /**
   * 查看结果
   */
  viewResult() {
    location.href = 'dictation-result.html';
  }

  /**
   * 复习错词
   */
  reviewWrong() {
    const wrongWords = this.answers
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
      mode: 'online',
      config: this.data.config,
      words: wrongWords,
      totalCount: wrongWords.length,
      generatedAt: Date.now(),
      isFromHistory: true  // 标记为查看历史记录
    };

    sessionStorage.setItem('dictation_data', JSON.stringify(newData));
    location.href = 'dictation-practice.html';
  }

  /**
   * 重新听写
   */
  restart() {
    location.reload();
  }

  /**
   * 睡眠函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 启动应用
new DictationPracticeApp();
