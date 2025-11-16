import { Logger } from '../utils/logger.js';

/**
 * 单词内容管理器
 */
export class LessonWords {
  constructor(book, lessonNumbers) {
    this.book = book;           // 'NCE1', 'NCE2', etc.
    this.lessonNumbers = lessonNumbers;  // ['001'] or ['001', '002']
    this.wordsLoaded = false;
    this.wordsData = null;
  }

  /**
   * 加载单词数据
   */
  async loadWords() {
    const wordsContent = document.getElementById('wordsContent');

    try {
      // 加载对应册的JSON文件
      const bookKey = this.book.toLowerCase().replace('nce', 'nce');
      const jsonUrl = `words/${bookKey}.json`;

      Logger.info(`加载单词数据: ${jsonUrl}, Lessons ${this.lessonNumbers.join(', ')}`);

      const response = await fetch(jsonUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // 查找所有课程
      const lessons = [];
      for (const lessonNumber of this.lessonNumbers) {
        const lesson = data.lessons.find(l => l.lessonNumber === lessonNumber);
        if (lesson) {
          lessons.push(lesson);
        } else {
          Logger.warn(`未找到课程: ${lessonNumber}`);
        }
      }

      if (lessons.length === 0) {
        Logger.warn(`未找到任何课程: ${this.lessonNumbers.join(', ')}`);
        this.showEmptyState();
        return;
      }

      const totalWords = lessons.reduce((sum, l) => sum + l.words.length, 0);
      if (totalWords === 0) {
        Logger.warn(`课程没有单词`);
        this.showEmptyState();
        return;
      }

      this.wordsData = lessons;
      this.renderWords(lessons);
      this.wordsLoaded = true;

      Logger.info(`成功加载 ${lessons.length} 课，共 ${totalWords} 个单词`);

    } catch (error) {
      Logger.error('单词加载失败:', error);
      this.showErrorState();
    }
  }

  /**
   * 渲染单词列表
   * @param {Array} lessons - 课程数组（单课或多课）
   */
  renderWords(lessons) {
    const wordsContent = document.getElementById('wordsContent');

    // 计算总单词数
    const totalWords = lessons.reduce((sum, l) => sum + l.words.length, 0);

    // 获取标题（使用第一课的标题）
    const firstLesson = lessons[0];
    const title = firstLesson.titleEn || `Lesson ${firstLesson.lessonNumber}`;
    const subtitle = firstLesson.titleCn || '';

    const html = `
      <div class="words-header">
        <h2>${this.escapeHtml(title)}</h2>
        ${subtitle ? `<p class="words-subtitle">${this.escapeHtml(subtitle)}</p>` : ''}
        <p class="word-count">${totalWords} 个单词</p>
      </div>

      <div class="words-list">
        <!-- 表头（仅PC显示） -->
        <div class="words-table-header">
          <span class="header-word">单词</span>
          <span class="header-phonetic">音标</span>
          <span class="header-pos">词性</span>
          <span class="header-meaning">释义</span>
        </div>

        ${lessons.map((lesson, index) => `
          ${lessons.length > 1 ? `
            <div class="lesson-group-header">
              <h3>Lesson ${lesson.lessonNumber}</h3>
              <span class="lesson-word-count">${lesson.words.length} 个单词</span>
            </div>
          ` : ''}
          ${lesson.words.map(word => `
            <div class="word-item">
              <div class="word-main">
                <span class="word-text">${this.escapeHtml(word.word)}</span>
                <span class="word-phonetic">${word.phonetic.length > 0 ?
                  `[${word.phonetic.map(p => this.escapeHtml(p)).join(', ')}]`
                  : ''}</span>
              </div>
              <div class="word-details">
                <span class="word-pos">${word.pos ? this.escapeHtml(word.pos) : ''}</span>
                <span class="word-meaning">${this.escapeHtml(word.meaning)}</span>
              </div>
              <div class="word-audio">
                <button class="audio-btn" data-word="${this.escapeHtml(word.word)}" data-accent="a" title="美式发音">
                  🔊 US
                </button>
                <button class="audio-btn" data-word="${this.escapeHtml(word.word)}" data-accent="e" title="英式发音">
                  🔊 UK
                </button>
              </div>
            </div>
          `).join('')}
        `).join('')}
      </div>
    `;

    wordsContent.innerHTML = html;

    // 绑定音频播放事件
    this.bindAudioEvents();
  }

  /**
   * 绑定音频播放事件
   */
  bindAudioEvents() {
    const wordsContent = document.getElementById('wordsContent');

    // 使用事件委托
    wordsContent.addEventListener('click', (e) => {
      const audioBtn = e.target.closest('.audio-btn');
      if (!audioBtn) return;

      const word = audioBtn.dataset.word;
      const accent = audioBtn.dataset.accent;

      if (word && accent) {
        this.playAudio(word, accent);
      }
    });
  }

  /**
   * 播放单词音频
   * @param {string} word - 单词
   * @param {string} accent - 发音类型 ('a' = 美式, 'e' = 英式)
   */
  async playAudio(word, accent) {
    const book = this.book.toLowerCase();
    const baseUrl = import.meta.env.BASE_URL;
    const audioUrl = `${baseUrl}words/${book}/${word}_${accent}.mp3`;

    try {
      const audio = new Audio(audioUrl);

      audio.onerror = () => {
        Logger.warn(`音频不存在: ${audioUrl}`);
        // 尝试备用发音
        const fallbackAccent = accent === 'a' ? 'e' : 'a';
        const fallbackUrl = `${baseUrl}words/${book}/${word}_${fallbackAccent}.mp3`;

        const fallbackAudio = new Audio(fallbackUrl);
        fallbackAudio.onerror = () => {
          Logger.error(`音频播放失败: ${word}`);
        };
        fallbackAudio.play().catch(err => {
          Logger.error('音频播放失败:', err);
        });
      };

      await audio.play();
      Logger.info(`播放音频: ${word} (${accent === 'a' ? '美式' : '英式'})`);
    } catch (error) {
      Logger.error('音频播放失败:', error);
    }
  }

  /**
   * 显示空状态
   */
  showEmptyState() {
    const wordsContent = document.getElementById('wordsContent');
    wordsContent.innerHTML = `
      <div class="empty-state">
        <p>📝 本课暂无单词数据</p>
      </div>
    `;
    this.wordsLoaded = true; // 标记为已加载，避免重复请求
  }

  /**
   * 显示错误状态
   */
  showErrorState() {
    const wordsContent = document.getElementById('wordsContent');
    wordsContent.innerHTML = `
      <div class="empty-state">
        <p>⚠️ 单词内容加载失败</p>
        <button onclick="location.reload()" class="control-btn">重试</button>
      </div>
    `;
  }

  /**
   * 转义HTML特殊字符
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 检查是否已加载
   * @returns {boolean}
   */
  isLoaded() {
    return this.wordsLoaded;
  }

  /**
   * 更新课程信息
   */
  updateLesson(book, lessonNumbers) {
    // 比较数组是否相同
    const isSame = this.book === book &&
                   this.lessonNumbers.length === lessonNumbers.length &&
                   this.lessonNumbers.every((num, idx) => num === lessonNumbers[idx]);

    if (!isSame) {
      this.book = book;
      this.lessonNumbers = lessonNumbers;
      this.wordsLoaded = false;
      this.wordsData = null;
    }
  }
}
