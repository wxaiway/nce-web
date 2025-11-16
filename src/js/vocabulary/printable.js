import { Logger } from '../utils/logger.js';
import { FontLoader } from '../utils/font-loader.js';
import { Toast } from '../utils/toast.js';
import { historyManager } from '../utils/history.js';
import { globalWakeLock } from '../utils/global-wake-lock.js';

/**
 * 打印稿页面
 */
class PrintableApp {
  constructor() {
    this.result = null;
    this.displayConfig = this.getDefaultDisplayConfig();
    this.init();
  }

  /**
   * 获取默认显示配置
   */
  getDefaultDisplayConfig() {
    return {
      showTitle: true,
      titleText: 'NCE 单词默写',
      showLessonRange: true,
      showWordCount: true,
      showDate: true,
      showNameField: true,
      showFooter: true,
      footerText: '提示：请先复习这些单词，熟悉后再进行默写练习。',
      columnCount: 4,
      wordFontSize: 13,
      lineStyle: 'triple', // 'single' | 'triple'
      paperSize: 'a4',
      showAnswer: false  // 是否显示答案（英文单词）
    };
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

    // 创建历史记录
    this.createHistory();

    // 渲染界面
    this.renderHeaderSubtitle();
    this.renderWords();
    this.preparePrint();

    // 绑定事件
    this.bindEvents();

    // 后台预加载字体（不阻塞页面）
    FontLoader.loadFont().catch(err => {
      Logger.warn('字体预加载失败:', err);
    });
  }

  /**
   * 加载数据
   */
  loadData() {
    const data = sessionStorage.getItem('printable_data');
    if (data) {
      this.result = JSON.parse(data);
      Logger.info('加载打印稿数据:', this.result);
    }
  }

  /**
   * 创建历史记录
   */
  createHistory() {
    if (!this.result || !this.result.config) {
      Logger.warn('无法创建历史记录：缺少数据');
      return;
    }

    // 如果是查看历史记录（标记为 isFromHistory），则不再创建新记录
    if (this.result.isFromHistory) {
      Logger.info('查看历史记录，跳过创建新记录');
      return;
    }

    // 创建默写稿历史记录，保存完整数据以便后续查看
    historyManager.addRecord({
      type: 'printable',
      config: this.result.config,
      wordCount: this.result.totalCount,
      // 保存完整的单词数据
      data: {
        words: this.result.words,
        wordCopies: this.result.wordCopies,
        allWords: this.result.allWords,
        totalCount: this.result.totalCount
      },
      createdAt: Date.now()
    });

    Logger.info('默写稿历史记录已创建');
  }

  /**
   * 渲染页面头部副标题
   */
  renderHeaderSubtitle() {
    const config = this.result.config;
    const date = new Date(this.result.generatedAt).toLocaleDateString('zh-CN');

    const parts = [
      `${config.book} L${parseInt(config.startLesson)}-${parseInt(config.endLesson)}`,
      `${this.result.totalCount} 个单词`,
      date
    ];

    document.getElementById('headerSubtitle').textContent = parts.join(' · ');
  }

  /**
   * 渲染单词列表
   */
  renderWords() {
    const container = document.getElementById('wordListContainer');
    const copyCount = this.result.config.copyCount || 1;
    const hasHeader = this.displayConfig.showTitle || this.hasMetaInfo();

    if (copyCount > 1) {
      // 多份模式
      container.innerHTML = this.result.wordCopies.map((words, index) => `
        <div class="word-copy">
          ${hasHeader ? `
          <div class="word-copy-header">
            ${this.displayConfig.showTitle ? `<div class="word-copy-title">${this.escapeHtml(this.displayConfig.titleText)} - 第 ${index + 1} 份</div>` : ''}
            ${this.hasMetaInfo() ? `<div class="word-copy-meta">${this.renderMetaInfo(words.length)}</div>` : ''}
          </div>
          ` : ''}
          <div class="word-list-single" style="--column-count: ${this.displayConfig.columnCount}; --word-font-size: ${this.displayConfig.wordFontSize}pt">
            ${words.map((word, idx) => this.renderWordItem(word, idx + 1)).join('')}
          </div>
          ${this.displayConfig.showFooter ? `
          <div class="word-copy-footer">
            <p>${this.escapeHtml(this.displayConfig.footerText)}</p>
          </div>
          ` : ''}
        </div>
      `).join('');
    } else {
      // 单份模式
      container.innerHTML = `
        ${hasHeader ? `
        <div class="word-copy-header">
          ${this.displayConfig.showTitle ? `<div class="word-copy-title">${this.escapeHtml(this.displayConfig.titleText)}</div>` : ''}
          ${this.hasMetaInfo() ? `<div class="word-copy-meta">${this.renderMetaInfo(this.result.words.length)}</div>` : ''}
        </div>
        ` : ''}
        <div class="word-list-single" style="--column-count: ${this.displayConfig.columnCount}; --word-font-size: ${this.displayConfig.wordFontSize}pt">
          ${this.result.words.map((word, idx) => this.renderWordItem(word, idx + 1)).join('')}
        </div>
        ${this.displayConfig.showFooter ? `
        <div class="word-copy-footer">
          <p>${this.escapeHtml(this.displayConfig.footerText)}</p>
        </div>
        ` : ''}
      `;
    }
  }

  /**
   * 检查是否有元信息需要显示
   */
  hasMetaInfo() {
    return this.displayConfig.showLessonRange ||
           this.displayConfig.showWordCount ||
           this.displayConfig.showDate ||
           this.displayConfig.showNameField;
  }

  /**
   * 渲染元信息
   */
  renderMetaInfo(wordCount) {
    const parts = [];
    if (this.displayConfig.showLessonRange) {
      parts.push(`${this.result.config.book} L${parseInt(this.result.config.startLesson)}-${parseInt(this.result.config.endLesson)}`);
    }
    if (this.displayConfig.showWordCount) {
      parts.push(`${wordCount} 个单词`);
    }
    if (this.displayConfig.showDate) {
      const date = new Date(this.result.generatedAt).toLocaleDateString('zh-CN');
      parts.push(date);
    }
    if (this.displayConfig.showNameField) {
      parts.push('姓名：________');
    }
    return parts.join(' · ');
  }

  /**
   * 渲染单个单词项
   */
  renderWordItem(word, index) {
    // 题目始终显示中文释义
    const text = `${index}. ${word.meaning}${word.pos ? ` (${word.pos})` : ''}`;
    const isTriple = this.displayConfig.lineStyle === 'triple';

    // 答案显示在线条区域
    let answerHtml = '';
    if (this.displayConfig.showAnswer) {
      answerHtml = `<div class="word-item-answer">${this.escapeHtml(word.word)}</div>`;
    }

    return `
      <div class="word-item ${isTriple ? 'triple-line' : 'single-line'}">
        <div class="word-item-content">${this.escapeHtml(text)}</div>
        <div class="word-item-lines">
          <div class="line line-top"></div>
          ${isTriple ? '<div class="line line-middle"></div>' : ''}
          <div class="line line-bottom"></div>
          ${answerHtml}
        </div>
      </div>
    `;
  }

  /**
   * 准备打印内容
   */
  preparePrint() {
    const config = this.result.config;
    const date = new Date(this.result.generatedAt).toLocaleDateString('zh-CN');

    // 更新打印标题内容
    const printTitle = document.querySelector('.print-title');
    if (printTitle) {
      printTitle.textContent = this.displayConfig.titleText;
    }

    const printMeta = document.getElementById('printMeta');
    if (printMeta) {
      const parts = [];
      if (this.displayConfig.showLessonRange) {
        parts.push(`${config.book} L${parseInt(config.startLesson)}-${parseInt(config.endLesson)}`);
      }
      if (this.displayConfig.showWordCount) {
        parts.push(`${this.result.totalCount} 个单词`);
      }
      if (this.displayConfig.showDate) {
        parts.push(date);
      }
      if (this.displayConfig.showNameField) {
        parts.push('姓名：________');
      }
      printMeta.textContent = parts.join(' · ');
    }

    // 更新打印页脚内容和显示状态
    const printFooter = document.querySelector('.print-footer');
    if (printFooter) {
      const footerP = printFooter.querySelector('p');
      if (footerP) {
        footerP.textContent = this.displayConfig.footerText;
      }
    }

    // 通过CSS类控制页脚显示
    this.updatePrintStyles();
  }

  /**
   * 更新打印样式
   */
  updatePrintStyles() {
    // 动态添加/移除样式来控制打印时的显示
    let styleEl = document.getElementById('dynamic-print-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-print-styles';
      document.head.appendChild(styleEl);
    }

    const styles = [];

    // 控制打印标题显示
    if (!this.displayConfig.showTitle) {
      styles.push('@media print { .print-title { display: none !important; } }');
    }

    // 控制打印元信息显示
    if (!this.hasMetaInfo()) {
      styles.push('@media print { .print-meta { display: none !important; } }');
    }

    // 控制打印页眉显示（标题和元信息都不显示时，隐藏整个页眉）
    if (!this.displayConfig.showTitle && !this.hasMetaInfo()) {
      styles.push('@media print { .print-header { display: none !important; } }');
    }

    // 控制打印页脚显示
    if (!this.displayConfig.showFooter) {
      styles.push('@media print { .print-footer { display: none !important; } }');
    }

    styleEl.textContent = styles.join('\n');
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 返回按钮
    document.getElementById('backBtn').addEventListener('click', () => {
      location.href = 'vocabulary.html';
    });

    // 设置按钮
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    // 打印按钮
    document.getElementById('printBtn')?.addEventListener('click', () => {
      this.printPDF();
    });

    // 下载PDF按钮
    document.getElementById('downloadPdfBtn')?.addEventListener('click', () => {
      this.downloadPDF();
    });

    // 分享PDF按钮
    document.getElementById('sharePdfBtn')?.addEventListener('click', () => {
      this.sharePDF();
    });

    // 设置面板
    document.getElementById('closeSettings').addEventListener('click', () => {
      this.closeSettings();
    });

    document.getElementById('resetSettings').addEventListener('click', () => {
      this.resetSettings();
    });

    document.getElementById('applySettings').addEventListener('click', () => {
      this.applySettings();
    });

    // 点击遮罩关闭
    document.querySelector('.settings-overlay')?.addEventListener('click', () => {
      this.closeSettings();
    });
  }

  /**
   * 打开设置面板
   */
  openSettings() {
    // 填充当前设置
    document.getElementById('showTitle').checked = this.displayConfig.showTitle;
    document.getElementById('titleText').value = this.displayConfig.titleText;
    document.getElementById('showLessonRange').checked = this.displayConfig.showLessonRange;
    document.getElementById('showWordCount').checked = this.displayConfig.showWordCount;
    document.getElementById('showDate').checked = this.displayConfig.showDate;
    document.getElementById('showNameField').checked = this.displayConfig.showNameField;
    document.getElementById('showFooter').checked = this.displayConfig.showFooter;
    document.getElementById('footerText').value = this.displayConfig.footerText;
    document.getElementById('columnCount').value = this.displayConfig.columnCount;
    document.getElementById('wordFontSize').value = this.displayConfig.wordFontSize;
    document.querySelector(`input[name="lineStyle"][value="${this.displayConfig.lineStyle}"]`).checked = true;
    document.querySelector(`input[name="paperSize"][value="${this.displayConfig.paperSize}"]`).checked = true;
    document.getElementById('showAnswer').checked = this.displayConfig.showAnswer;

    // 显示面板
    const panel = document.getElementById('settingsPanel');
    panel.style.display = 'block';

    // 点击遮罩层关闭
    const overlay = panel.querySelector('.settings-overlay');
    overlay.onclick = () => this.closeSettings();
  }

  /**
   * 关闭设置面板
   */
  closeSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.style.display = 'none';
  }

  /**
   * 重置设置
   */
  resetSettings() {
    this.displayConfig = this.getDefaultDisplayConfig();
    this.openSettings();
  }

  /**
   * 应用设置
   */
  applySettings() {
    // 读取设置
    this.displayConfig.showTitle = document.getElementById('showTitle').checked;
    this.displayConfig.titleText = document.getElementById('titleText').value;
    this.displayConfig.showLessonRange = document.getElementById('showLessonRange').checked;
    this.displayConfig.showWordCount = document.getElementById('showWordCount').checked;
    this.displayConfig.showDate = document.getElementById('showDate').checked;
    this.displayConfig.showNameField = document.getElementById('showNameField').checked;
    this.displayConfig.showFooter = document.getElementById('showFooter').checked;
    this.displayConfig.footerText = document.getElementById('footerText').value;
    this.displayConfig.columnCount = parseInt(document.getElementById('columnCount').value);
    this.displayConfig.wordFontSize = parseInt(document.getElementById('wordFontSize').value);
    this.displayConfig.lineStyle = document.querySelector('input[name="lineStyle"]:checked').value;
    this.displayConfig.paperSize = document.querySelector('input[name="paperSize"]:checked').value;
    this.displayConfig.showAnswer = document.getElementById('showAnswer').checked;

    // 重新渲染
    this.renderWords();
    this.preparePrint();

    // 关闭面板
    this.closeSettings();
  }

  /**
   * 打印PDF
   */
  async printPDF() {
    const loading = Toast.loading('正在准备打印...');

    try {
      const blob = await this.generatePDF();
      const url = URL.createObjectURL(blob);

      // 在新窗口打开PDF并触发打印
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        loading.close();
        Toast.success('打印准备完成');
      } else {
        loading.close();
        Toast.warning('无法打开打印窗口，请允许弹出窗口');
        this.downloadPDF();
      }
    } catch (error) {
      loading.close();
      Logger.error('打印失败:', error);
      Toast.error('打印失败：' + error.message);
    }
  }

  /**
   * 下载PDF
   */
  async downloadPDF() {
    const loading = Toast.loading('正在准备 PDF...');

    try {
      const blob = await this.generatePDF();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.generateFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);

      loading.close();
      Toast.success('PDF 生成成功');
    } catch (error) {
      loading.close();
      Logger.error('下载失败:', error);
      Toast.error('下载失败：' + error.message);
    }
  }

  /**
   * 分享PDF（移动端）
   */
  async sharePDF() {
    const isWechat = /MicroMessenger/i.test(navigator.userAgent);

    if (isWechat) {
      Toast.warning('请点击右上角 ··· 选择"在浏览器打开"后分享', 3000);
      return;
    }

    const loading = Toast.loading('正在准备分享...');

    try {
      const blob = await this.generatePDF();
      const file = new File([blob], this.generateFilename(), { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'NCE 单词默写稿',
          text: 'New Concept English 单词练习'
        });
        loading.close();
        Toast.success('分享成功');
      } else {
        loading.close();
        // 回退到下载
        this.downloadPDF();
      }
    } catch (error) {
      loading.close();
      if (error.name === 'AbortError') {
        Logger.info('用户取消分享');
      } else {
        Logger.error('分享失败:', error);
        this.downloadPDF();
      }
    }
  }

  /**
   * 生成PDF
   */
  async generatePDF() {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      throw new Error('jsPDF 库未加载');
    }

    // 加载字体
    const fontBase64 = await FontLoader.loadFont();

    // 纸张设置
    const paperSize = this.displayConfig.paperSize;
    let pageWidth = 210;
    let pageHeight = 297;
    if (paperSize === 'a5') {
      pageWidth = 148;
      pageHeight = 210;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: paperSize
    });

    // 添加自定义中文字体
    doc.addFileToVFS('FangZhengKaiTi.ttf', fontBase64);
    doc.addFont('FangZhengKaiTi.ttf', 'FangZhengKaiTi', 'normal');
    doc.setFont('FangZhengKaiTi');

    const margin = { top: 15, right: 10, bottom: 10, left: 10 };
    const contentWidth = pageWidth - margin.left - margin.right;

    const config = this.result.config;
    const date = new Date(this.result.generatedAt).toLocaleDateString('zh-CN');
    const copyCount = config.copyCount || 1;

    // 获取单词列表
    const wordCopies = copyCount > 1 ? this.result.wordCopies : [this.result.words];

    // 渲染每一份
    wordCopies.forEach((words, copyIndex) => {
      if (copyIndex > 0) {
        doc.addPage();
      }

      let y = margin.top;
      const hasHeader = this.displayConfig.showTitle || this.hasMetaInfo();

      // 标题
      if (this.displayConfig.showTitle) {
        doc.setFontSize(16);
        const title = copyCount > 1 ?
          `${this.displayConfig.titleText} - 第 ${copyIndex + 1} 份` :
          this.displayConfig.titleText;
        const titleWidth = doc.getTextWidth(title);
        doc.text(title, (pageWidth - titleWidth) / 2, y);
        y += 8;
      }

      // 元信息（使用与网页一致的格式）
      const metaParts = [];
      if (this.displayConfig.showLessonRange) {
        metaParts.push(`${config.book} L${parseInt(config.startLesson)}-${parseInt(config.endLesson)}`);
      }
      if (this.displayConfig.showWordCount) {
        metaParts.push(`${words.length} 个单词`);
      }
      if (this.displayConfig.showDate) {
        metaParts.push(date);
      }
      if (this.displayConfig.showNameField) {
        metaParts.push('姓名：________');
      }

      if (metaParts.length > 0) {
        doc.setFontSize(10);
        const metaText = metaParts.join(' · ');
        const metaWidth = doc.getTextWidth(metaText);
        doc.text(metaText, (pageWidth - metaWidth) / 2, y);
        y += 6;
      }

      // 分隔线（只有在有标题或元信息时才显示）
      if (hasHeader) {
        doc.setLineWidth(0.3);
        doc.setDrawColor(200, 200, 200);
        doc.line(margin.left, y, pageWidth - margin.right, y);
        y += 3;  // 减少分隔线到第一行单词的距离
      }

      // 单词列表（多列布局）
      const columns = this.displayConfig.columnCount;
      const columnGap = 3;
      const availableWidth = contentWidth - (columns - 1) * columnGap;
      const columnWidth = availableWidth / columns;
      const fontSize = this.displayConfig.wordFontSize;

      // 单词项高度（单线和三线格使用相同的高度，确保布局一致）
      const isTriple = this.displayConfig.lineStyle === 'triple';
      const itemHeight = fontSize * 0.8 + 14;  // 约 24.4mm（紧凑布局）

      let col = 0;
      let row = 0;

      words.forEach((word, index) => {
        const x = margin.left + col * (columnWidth + columnGap);

        // 检查是否需要换页（只在每行的第一个单词时检查）
        if (col === 0) {
          const rowBottomY = y + (row + 1) * itemHeight;
          if (rowBottomY > pageHeight - margin.bottom) {
            doc.addPage();
            y = margin.top;
            row = 0;
          }
        }

        const currentY = y + row * itemHeight;

        // 绘制单词（题目始终显示中文释义）
        doc.setFontSize(fontSize);
        const text = `${index + 1}. ${word.meaning} ${word.pos ? `(${word.pos})` : ''}`;

        // 使用 splitTextToSize 实现自动换行
        // 给 jsPDF 额外的宽度余量，补偿中文字体宽度计算的不准确性
        const lines = doc.splitTextToSize(text, columnWidth * 1.05);
        const lineCount = Array.isArray(lines) ? lines.length : 1;

        // 绘制线条（根据配置选择单线或三线格）
        doc.setLineWidth(0.2);

        // 统一的布局逻辑（单线和三线格完全一致）
        const lineHeight = 10; // 三线格总高度

        // 固定顶线位置（所有单词对齐）
        const topLineY = y + row * itemHeight + itemHeight - lineHeight - 2;

        // 根据文本行数动态调整：最后一行基线到顶线的距离
        let lastLineToTopGap;
        if (lineCount === 1) {
          lastLineToTopGap = 3;  // 单行：3mm（空间多一点）
        } else if (lineCount === 2) {
          lastLineToTopGap = 1.5;  // 两行：1.5mm（紧凑一点）
        } else {
          lastLineToTopGap = 1; // 三行及以上：1mm（更紧凑）
        }

        // 计算最后一行基线位置
        const lastLineY = topLineY - lastLineToTopGap;

        // 计算第一行基线位置（向上推算）
        const lineHeightPt = doc.getLineHeight() / doc.internal.scaleFactor;
        let textY = lastLineY - (lineCount - 1) * lineHeightPt;

        // 保护机制：确保文本不会超出页面顶部
        const minTextY = margin.top + fontSize * 0.5;
        if (textY < minTextY) {
          Logger.warn(`单词 ${index + 1} 文本位置过高，已调整: textY=${textY.toFixed(2)} -> ${minTextY.toFixed(2)}, lineCount=${lineCount}, lineHeight=${lineHeightPt.toFixed(2)}mm`);
          textY = minTextY;
        }

        // 绘制文本
        doc.text(lines, x, textY);

        // 绘制线条
        if (isTriple) {
          // 三线格模式：绘制顶线、中线、底线

          // 顶线
          doc.line(x, topLineY, x + columnWidth, topLineY);

          // 中线（虚线）
          doc.setLineDash([1, 1]);
          doc.line(x, topLineY + lineHeight / 2, x + columnWidth, topLineY + lineHeight / 2);
          doc.setLineDash([]); // 恢复实线

          // 底线
          doc.line(x, topLineY + lineHeight, x + columnWidth, topLineY + lineHeight);
        } else {
          // 单线模式：只绘制底线
          doc.line(x, topLineY + lineHeight, x + columnWidth, topLineY + lineHeight);
        }

        // 如果是答案版，在线条区域绘制答案
        if (this.displayConfig.showAnswer) {
          // 答案位置
          let answerY;
          if (isTriple) {
            // 三线格：答案在中线位置
            answerY = topLineY + lineHeight / 2;
          } else {
            // 单线：答案在线上方2mm
            answerY = topLineY + lineHeight - 2;
          }

          // 使用较小的字体和灰色
          doc.setFontSize(fontSize * 0.75);  // 75%大小
          doc.setTextColor(150, 150, 150);   // 灰色

          // 绘制答案
          doc.text(word.word, x + 2, answerY);

          // 恢复默认设置
          doc.setFontSize(fontSize);
          doc.setTextColor(0, 0, 0);
        }

        // 移动到下一列
        col++;
        if (col >= columns) {
          col = 0;
          row++;
        }
      });

      // 页脚
      if (this.displayConfig.showFooter) {
        const footerY = pageHeight - margin.bottom + 5;
        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        const footerWidth = doc.getTextWidth(this.displayConfig.footerText);
        doc.text(this.displayConfig.footerText, (pageWidth - footerWidth) / 2, footerY);
        doc.setTextColor(0, 0, 0); // 恢复默认颜色
      }
    });

    return doc.output('blob');
  }

  /**
   * 生成文件名
   */
  generateFilename() {
    const config = this.result.config;
    const date = new Date().toISOString().slice(0, 10);
    const suffix = this.displayConfig.showAnswer ? '-答案版' : '';
    return `NCE-${config.book}-L${parseInt(config.startLesson)}-${parseInt(config.endLesson)}-${date}${suffix}.pdf`;
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
new PrintableApp();
