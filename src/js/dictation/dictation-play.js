import { Logger } from '../utils/logger.js';
import { FontLoader } from '../utils/font-loader.js';
import { Toast } from '../utils/toast.js';
import { historyManager } from '../utils/history.js';
import { globalWakeLock } from '../utils/global-wake-lock.js';

/**
 * 听写播放页（线下手写模式）
 */
class DictationPlayApp {
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
    this.showAnswers = false;
    this.isWaitingInput = false;
    this.remainingTime = 0;
    this.currentResolve = null; // 当前 Promise 的 resolve 函数
    this.shouldReplay = false; // 标记是否需要重播
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
    this.renderAnswerList();
    this.updateProgress();
    this.bindEvents();

    // 后台预加载字体（不阻塞播放）
    FontLoader.loadFont().catch(err => {
      Logger.warn('字体预加载失败:', err);
    });

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
    document.getElementById('playTitle').textContent = title;
  }

  /**
   * 渲染答案列表
   */
  renderAnswerList() {
    const container = document.getElementById('answerList');
    const config = this.data.config;

    container.innerHTML = this.data.words.map((word, index) => {
      const info = [];
      if (config.showPos && word.pos) info.push(word.pos);
      if (config.showMeaning && word.meaning) info.push(word.meaning);

      return `
        <div class="answer-item">
          <div class="answer-item-header">
            <span class="answer-item-number">${index + 1}.</span>
            <span class="answer-item-info">${info.map(i => this.escapeHtml(i)).join(' ')}</span>
          </div>
          <div class="answer-item-word">${this.escapeHtml(word.word)}</div>
        </div>
      `;
    }).join('');
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

      // 开始播放
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

    // 显示答案按钮
    document.getElementById('showAnswersBtn').addEventListener('click', () => {
      this.toggleAnswers(true);
    });

    // 隐藏答案按钮
    document.getElementById('hideAnswersBtn').addEventListener('click', () => {
      this.toggleAnswers(false);
    });

    // 下载 PDF 按钮
    document.getElementById('downloadPdfBtn')?.addEventListener('click', () => {
      this.downloadPdf();
    });

    // 分享 PDF 按钮（移动端）
    document.getElementById('sharePdfBtn')?.addEventListener('click', () => {
      this.sharePdf();
    });

    // 打印按钮
    document.getElementById('printBtn')?.addEventListener('click', () => {
      this.print();
    });

    // 完成界面按钮
    document.getElementById('inputAnswersBtn')?.addEventListener('click', () => {
      this.goToInputPage();
    });

    document.getElementById('skipInputBtn')?.addEventListener('click', () => {
      this.skipInput();
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
        if (!this.isPaused && this.isWaitingInput) {
          this.replayCurrentWord();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!this.isPaused && this.isWaitingInput) {
          this.nextWord();
        }
      } else if (e.key === 'Escape') {
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
   * 切换答案显示/隐藏
   */
  toggleAnswers(show) {
    this.showAnswers = show;
    document.getElementById('answerListArea').style.display = show ? 'block' : 'none';
    document.getElementById('showAnswersContainer').style.display = show ? 'none' : 'flex';
  }

  /**
   * 开始播放
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
        await this.waitInterval();
      } while (this.shouldReplay);

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
    this.updateButtonStates();

    // 播放音频
    for (let i = 0; i < config.playCount; i++) {
      if (this.isPaused) {
        await this.waitForResume();
      }

      this.updateStatus(`正在播放第 ${i + 1} 遍...`);
      await this.playAudio(word.word, config.accent);

      if (i < config.playCount - 1) {
        await this.sleep(1000);
      }
    }

    this.updateStatus('请在纸上写下这个单词');
  }

  /**
   * 更新单词信息
   */
  updateWordInfo(word) {
    document.getElementById('wordNumber').textContent = this.currentIndex + 1;

    // 显示词性提示
    const posElement = document.getElementById('wordPos');
    if (this.data.config.showPos && word.pos) {
      posElement.textContent = word.pos;
      posElement.style.display = 'inline-block';
    } else {
      posElement.style.display = 'none';
    }

    // 显示中文提示
    const meaningElement = document.getElementById('wordMeaning');
    if (this.data.config.showMeaning && word.meaning) {
      meaningElement.textContent = word.meaning;
      meaningElement.style.display = 'inline-block';
    } else {
      meaningElement.style.display = 'none';
    }
  }

  /**
   * 更新状态文字
   */
  updateStatus(text) {
    document.getElementById('statusText').textContent = text;
  }

  /**
   * 更新按钮状态
   */
  updateButtonStates() {
    const replayBtn = document.getElementById('replayBtn');
    const nextBtn = document.getElementById('nextBtn');

    // 播放中或暂停时禁用重播和下一个按钮
    const shouldEnable = this.isWaitingInput && !this.isPaused;

    if (replayBtn) {
      replayBtn.disabled = !shouldEnable;
    }
    if (nextBtn) {
      nextBtn.disabled = !shouldEnable;
    }
  }

  /**
   * 播放音频
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
   * 等待间隔时间
   */
  async waitInterval() {
    // 如果已经在等待输入，先清除
    if (this.isWaitingInput) {
      this.clearWaitInput();
    }

    this.isWaitingInput = true;
    this.updateButtonStates();

    const interval = this.data.config.interval;
    return new Promise((resolve) => {
      this.currentResolve = resolve;

      // 如果有剩余时间（从暂停恢复），使用剩余时间，否则使用完整间隔
      let remaining = this.remainingTime > 0 ? this.remainingTime : interval;
      this.remainingTime = 0;

      const updateCountdown = () => {
        document.getElementById('countdown').textContent = `${remaining}秒后自动下一个`;
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
          this.updateButtonStates();
          document.getElementById('countdown').textContent = '';
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
    this.updateButtonStates();
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
    const pauseText = document.getElementById('pauseText');

    if (this.isPaused) {
      if (pauseIcon) pauseIcon.textContent = '▶️';
      if (pauseText) pauseText.textContent = '继续';
      this.pauseStartTime = Date.now();

      // 停止音频
      if (this.audioElement) {
        this.audioElement.pause();
      }

      this.updateStatus('已暂停');
    } else {
      if (pauseIcon) pauseIcon.textContent = '⏸️';
      if (pauseText) pauseText.textContent = '暂停';

      if (this.pauseStartTime) {
        this.pausedTime += Date.now() - this.pauseStartTime;
        this.pauseStartTime = null;
      }

      this.updateStatus('继续播放...');

      // 恢复音频
      if (this.audioElement && this.audioElement.paused && !this.audioElement.ended) {
        this.audioElement.play().catch(err => {
          Logger.warn('恢复音频播放失败:', err);
        });
      }

      // 恢复倒计时
      if (this.isWaitingInput && this.remainingTime > 0) {
        this.resumeCountdownAfterPause();
      }
    }

    this.updateButtonStates();
  }

  /**
   * 暂停后恢复倒计时
   */
  resumeCountdownAfterPause() {
    const updateCountdown = () => {
      document.getElementById('countdown').textContent = `${this.remainingTime}秒后自动下一个`;
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
        this.updateButtonStates();
        document.getElementById('countdown').textContent = '';
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

    document.getElementById('progressFill').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${current}/${total}`;

    // 更新已用时间
    const elapsed = Math.floor((Date.now() - this.startTime - this.pausedTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('elapsedTime').textContent = `${minutes}分${seconds}秒`;
  }

  /**
   * 完成播放
   */
  complete() {
    const endTime = Date.now();
    const duration = Math.floor((endTime - this.startTime - this.pausedTime) / 1000);

    // 更新完成界面
    document.getElementById('finalTotal').textContent = this.data.words.length;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    document.getElementById('finalTime').textContent = `${minutes}分${seconds}秒`;

    // 保存播放记录
    this.savePlayHistory(duration);

    // 显示完成界面
    document.getElementById('completionScreen').style.display = 'flex';
  }

  /**
   * 保存播放历史
   */
  savePlayHistory(duration) {
    // 线下模式的历史记录已经在 startDictation 时创建
    // 这里不需要再创建记录
    Logger.info('线下听写播放完成，用时:', duration, '秒');
  }

  /**
   * 下载 PDF
   * @param {boolean} returnBlob - 是否返回 Blob 而不是下载
   */
  async downloadPdf(returnBlob = false) {
    const loading = returnBlob ? null : Toast.loading('正在准备 PDF...');

    try {
      // 加载字体
      const fontBase64 = await FontLoader.loadFont();

      if (loading) loading.update('正在生成 PDF...');

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // 添加中文字体
      doc.addFileToVFS('FangZhengKaiTi.ttf', fontBase64);
      doc.addFont('FangZhengKaiTi.ttf', 'FangZhengKaiTi', 'normal');
      doc.setFont('FangZhengKaiTi');

      const config = this.data.config;
      const title = `NCE 听写答案 - ${config.book} L${config.startLesson}-${config.endLesson}`;
      const date = new Date().toLocaleDateString('zh-CN');

      // 标题
      doc.setFontSize(16);
      doc.text(title, 105, 20, { align: 'center' });

      // 副标题
      doc.setFontSize(10);
      doc.text(`共 ${this.data.words.length} 个单词 · ${date}`, 105, 28, { align: 'center' });

      // 单词列表 - 5列布局
      let y = 40;
      const lineHeight = 10;
      const columnWidth = 37;
      let column = 0;

      this.data.words.forEach((word, index) => {
        const x = 10 + column * columnWidth;

        // 序号和词性/中文
        doc.setFontSize(8);
        const info = [];
        if (config.showPos && word.pos) info.push(word.pos);
        if (config.showMeaning && word.meaning) info.push(word.meaning);
        doc.text(`${index + 1}. ${info.join(' ')}`, x, y);

        // 英文单词
        doc.setFontSize(10);
        doc.text(word.word, x, y + 4);

        column++;
        if (column >= 5) {
          column = 0;
          y += lineHeight;
        }

        // 换页
        if (y > 270) {
          doc.addPage();
          y = 20;
          column = 0;
        }
      });

      // 返回 Blob 或下载
      if (returnBlob) {
        return doc.output('blob');
      } else {
        doc.save(`${title}.pdf`);
        if (loading) loading.close();
        Toast.success('PDF 生成成功');
      }
    } catch (error) {
      if (loading) loading.close();
      Logger.error('生成 PDF 失败:', error);
      Toast.error('生成 PDF 失败，请稍后重试');
      throw error;
    }
  }

  /**
   * 分享 PDF（移动端）
   */
  async sharePdf() {
    // 检测微信环境
    const isWechat = /MicroMessenger/i.test(navigator.userAgent);
    if (isWechat) {
      Toast.warning('请点击右上角 ··· 选择"在浏览器打开"后分享', 3000);
      return;
    }

    const loading = Toast.loading('正在准备分享...');

    try {
      // 生成 PDF Blob
      const blob = await this.downloadPdf(true);

      const config = this.data.config;
      const filename = `NCE 听写答案 - ${config.book} L${config.startLesson}-${config.endLesson}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });

      // 使用 Web Share API 分享
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'NCE 听写答案',
          text: 'New Concept English 听写练习'
        });
        loading.close();
        Toast.success('分享成功');
      } else {
        loading.close();
        // 不支持分享，回退到下载
        Toast.info('您的浏览器不支持分享，将为您下载文件');
        await this.downloadPdf();
      }
    } catch (error) {
      loading.close();
      if (error.name === 'AbortError') {
        Logger.info('用户取消分享');
      } else {
        Logger.error('分享失败:', error);
        Toast.error('分享失败，将为您下载文件');
        await this.downloadPdf();
      }
    }
  }

  /**
   * 打印
   */
  print() {
    // 准备打印内容
    const config = this.data.config;
    const title = `NCE 听写答案 - ${config.book} L${config.startLesson}-${config.endLesson}`;
    const date = new Date().toLocaleDateString('zh-CN');

    document.getElementById('printTitle').textContent = title;
    document.getElementById('printMeta').textContent = `共 ${this.data.words.length} 个单词 · ${date}`;

    // 复制答案列表到打印区域
    const printContent = document.getElementById('printContent');
    const answerList = document.getElementById('answerList').cloneNode(true);
    printContent.innerHTML = '';
    printContent.appendChild(answerList);

    // 显示打印内容
    document.querySelector('.print-only').style.display = 'block';

    // 打印
    window.print();

    // 隐藏打印内容
    document.querySelector('.print-only').style.display = 'none';
  }

  /**
   * 跳转到答案录入页
   */
  goToInputPage() {
    sessionStorage.setItem('dictation_input_data', JSON.stringify(this.data));
    location.href = 'dictation-input.html';
  }

  /**
   * 跳过录入
   */
  skipInput() {
    if (confirm('确定跳过答案录入吗？将无法进行批改。')) {
      location.href = 'vocabulary.html';
    }
  }

  /**
   * 重新播放
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
new DictationPlayApp();
