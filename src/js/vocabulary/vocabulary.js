import { Logger } from '../utils/logger.js';
import { Storage } from '../utils/storage.js';
import { historyManager } from '../utils/history.js';
import { renderVersion } from '../utils/version.js';

/**
 * 单词练习配置页
 * 注意: 这是配置页，不需要屏幕常亮功能
 */
class VocabularyApp {
  constructor() {
    this.selectedBook = 'NCE1';
    this.startLesson = 1;
    this.endLesson = 10;
    this.lessonOptions = {}; // 存储每册的课程选项
    this.maxLessons = { NCE1: 143, NCE2: 96, NCE3: 60, NCE4: 48 }; // 每册的最大课程号
    this.init();
  }

  async init() {
    try {

      // 加载课程列表
      await this.loadLessonOptions();

      // 加载上次配置
      this.loadLastConfig();

      // 初始化UI
      this.initBookSelector();
      this.initRangeSelector();
      this.initQuickSelect();
      this.initButtons();
      this.initDictationSettings();

      // 恢复其他配置
      this.restoreOtherConfigs();

      // 初始化历史记录
      this.initHistory();

      // 更新统计
      this.updateStats();
    } catch (error) {
      Logger.error('初始化失败:', error);
      alert('页面加载失败，请刷新重试');
    }
  }

  /**
   * 加载课程列表
   */
  async loadLessonOptions() {
    try {
      const response = await fetch(import.meta.env.BASE_URL + 'static/data.json');
      const data = await response.json();

      // 转换为课程选项格式
      for (let i = 1; i <= 4; i++) {
        const lessons = data[i] || [];
        this.lessonOptions[`NCE${i}`] = lessons.map(lesson => {
          // 提取课程编号（去除 & 符号）
          const match = lesson.filename.match(/^(\d+)/);
          const number = match ? match[1].padStart(3, '0') : '001';
          return {
            number,
            title: lesson.title
          };
        });
      }

      Logger.info('课程列表加载完成', this.lessonOptions);
    } catch (error) {
      Logger.error('加载课程列表失败:', error);
      throw error;
    }
  }

  /**
   * 加载上次配置
   */
  loadLastConfig() {
    const lastConfig = Storage.get('vocabulary_last_config');

    if (lastConfig) {
      Logger.info('加载上次配置:', lastConfig);

      // 恢复基本配置
      this.selectedBook = lastConfig.book || 'NCE1';
      this.startLesson = lastConfig.startLesson || 1;
      this.endLesson = lastConfig.endLesson || 10;

      // 保存其他配置供后续恢复
      this.lastConfig = lastConfig;

      // 恢复听写配置（如果有）
      if (lastConfig.dictation) {
        this.dictationConfig = lastConfig.dictation;
      }
    }
  }

  /**
   * 保存当前配置
   */
  saveCurrentConfig() {
    const config = {
      book: this.selectedBook,
      startLesson: this.startLesson,
      endLesson: this.endLesson,
      studyMode: this.getStudyMode(),
      wordCount: this.getWordCount(),
      posFilter: this.getPosFilter(),
      copyCount: this.getCopyCount(),
      dictation: this.getDictationConfig(),
      updatedAt: Date.now()
    };

    Storage.set('vocabulary_last_config', config);
    Logger.info('保存配置:', config);
  }

  /**
   * 获取排列方式
   */
  getStudyMode() {
    const studyModeSelect = document.getElementById('studyMode');
    return studyModeSelect ? studyModeSelect.value : 'sequential';
  }

  /**
   * 获取单词数量
   */
  getWordCount() {
    const wordCountSelect = document.getElementById('wordCount');
    if (!wordCountSelect) return 'all';

    if (wordCountSelect.value === 'custom') {
      const customInput = document.getElementById('customWordCount');
      return customInput ? `custom:${customInput.value}` : 'all';
    }
    return wordCountSelect.value;
  }

  /**
   * 获取词性筛选
   */
  getPosFilter() {
    const posFilterSelect = document.getElementById('posFilter');
    return posFilterSelect ? posFilterSelect.value : 'all';
  }

  /**
   * 获取生成份数
   */
  getCopyCount() {
    const copyCountSelect = document.getElementById('copyCount');
    if (!copyCountSelect) return '1';

    if (copyCountSelect.value === 'custom') {
      const customInput = document.getElementById('customCopyCount');
      return customInput ? `custom:${customInput.value}` : '1';
    }
    return copyCountSelect.value;
  }

  /**
   * 获取听写配置
   */
  getDictationConfig() {
    const config = {};

    // 获取模式
    const modeRadios = document.querySelectorAll('input[name="dictationMode"]');
    modeRadios.forEach(radio => {
      if (radio.checked) {
        config.mode = radio.value;
      }
    });

    // 获取发音
    const accentSelect = document.getElementById('dictationAccent');
    if (accentSelect) {
      config.accent = accentSelect.value;
    }

    // 获取播放次数
    const playCountSelect = document.getElementById('dictationPlayCount');
    if (playCountSelect) {
      if (playCountSelect.value === 'custom') {
        const customPlayCount = document.getElementById('customDictationPlayCount');
        config.playCount = customPlayCount ? parseInt(customPlayCount.value) || 2 : 2;
      } else {
        config.playCount = parseInt(playCountSelect.value) || 2;
      }
    }

    // 获取间隔时间
    const intervalSelect = document.getElementById('dictationInterval');
    if (intervalSelect) {
      if (intervalSelect.value === 'custom') {
        const customInterval = document.getElementById('customDictationInterval');
        config.interval = customInterval ? parseInt(customInterval.value) || 5 : 5;
      } else {
        config.interval = parseInt(intervalSelect.value) || 5;
      }
    }

    // 获取提示选项
    const showHintsCheckbox = document.getElementById('showHints');
    if (showHintsCheckbox) {
      config.showHints = showHintsCheckbox.checked;
    }

    // 获取词性提示
    const showPosCheckbox = document.getElementById('dictationShowPos');
    if (showPosCheckbox) {
      config.showPos = showPosCheckbox.checked;
    }

    // 获取中文提示
    const showMeaningCheckbox = document.getElementById('dictationShowMeaning');
    if (showMeaningCheckbox) {
      config.showMeaning = showMeaningCheckbox.checked;
    }

    return config;
  }

  /**
   * 初始化册数选择
   */
  initBookSelector() {
    const radios = document.querySelectorAll('input[name="bookSelect"]');

    // 恢复上次选择的册数
    radios.forEach(radio => {
      if (radio.value === this.selectedBook) {
        radio.checked = true;
      }

      radio.addEventListener('change', () => {
        // 更新选中的册数
        this.selectedBook = radio.value;

        // 更新范围输入框
        this.updateRangeInputs();

        // 更新统计
        this.updateStats();

        // 保存配置
        this.saveCurrentConfig();
      });
    });
  }

  /**
   * 初始化范围选择
   */
  initRangeSelector() {
    const startInput = document.getElementById('startLesson');
    const endInput = document.getElementById('endLesson');

    // 设置初始值和范围
    this.updateRangeInputs();

    // 监听开始课程变化
    startInput.addEventListener('input', () => {
      const value = parseInt(startInput.value);
      if (value && value >= 1) {
        this.startLesson = value;
        // 更新结束课程的最小值
        endInput.min = value;
        // 如果结束课程小于开始课程，自动调整
        if (this.endLesson < value) {
          this.endLesson = value;
          endInput.value = value;
        }
        this.updateStats();
        this.saveCurrentConfig();
      }
    });

    // 监听结束课程变化
    endInput.addEventListener('input', () => {
      const value = parseInt(endInput.value);
      if (value && value >= this.startLesson) {
        this.endLesson = value;
        this.updateStats();
        this.saveCurrentConfig();
      }
    });

    // 失去焦点时验证
    startInput.addEventListener('blur', () => {
      this.validateLessonInput(startInput, 'start');
    });

    endInput.addEventListener('blur', () => {
      this.validateLessonInput(endInput, 'end');
    });
  }

  /**
   * 验证课程输入
   */
  validateLessonInput(input, type) {
    const maxLesson = this.maxLessons[this.selectedBook];
    let value = parseInt(input.value);

    if (!value || value < 1) {
      value = 1;
    } else if (value > maxLesson) {
      value = maxLesson;
    }

    if (type === 'start') {
      this.startLesson = value;
      if (this.endLesson < value) {
        this.endLesson = value;
        document.getElementById('endLesson').value = value;
      }
    } else {
      if (value < this.startLesson) {
        value = this.startLesson;
      }
      this.endLesson = value;
    }

    input.value = value;
    this.updateStats();
    this.saveCurrentConfig();
  }

  /**
   * 更新范围输入框
   */
  updateRangeInputs() {
    const startInput = document.getElementById('startLesson');
    const endInput = document.getElementById('endLesson');
    const maxLesson = this.maxLessons[this.selectedBook];

    // 设置最大值
    startInput.max = maxLesson;
    endInput.max = maxLesson;

    // 验证当前值是否在有效范围内
    if (this.startLesson > maxLesson) {
      this.startLesson = 1;
    }
    if (this.endLesson > maxLesson) {
      this.endLesson = Math.min(10, maxLesson);
    }
    if (this.endLesson < this.startLesson) {
      this.endLesson = this.startLesson;
    }

    // 更新输入框的值
    startInput.value = this.startLesson;
    endInput.value = this.endLesson;
    endInput.min = this.startLesson;
  }

  /**
   * 初始化快捷选择
   */
  initQuickSelect() {
    const buttons = document.querySelectorAll('.quick-select button');
    Logger.info('快捷选择按钮数量:', buttons.length);
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const range = btn.dataset.range;
        Logger.info('点击快捷选择:', range);
        this.applyQuickRange(range);
      });
    });
  }

  /**
   * 应用快捷范围
   */
  applyQuickRange(range) {
    Logger.info('应用快捷范围:', range, '当前册数:', this.selectedBook);
    const lessons = this.lessonOptions[this.selectedBook] || [];
    if (lessons.length === 0) {
      Logger.warn('没有课程数据');
      return;
    }

    const startInput = document.getElementById('startLesson');
    const endInput = document.getElementById('endLesson');

    if (range === 'all') {
      this.startLesson = 1;
      this.endLesson = this.maxLessons[this.selectedBook];
      Logger.info('选择全部:', this.startLesson, '-', this.endLesson);
    } else {
      const [start, end] = range.split('-').map(n => parseInt(n));
      const maxLesson = this.maxLessons[this.selectedBook];

      // 确保范围有效
      this.startLesson = Math.max(1, Math.min(start, maxLesson));
      this.endLesson = Math.max(this.startLesson, Math.min(end, maxLesson));

      Logger.info('设置课程范围:', this.startLesson, '-', this.endLesson);
    }

    startInput.value = this.startLesson;
    endInput.value = this.endLesson;
    endInput.min = this.startLesson;
    Logger.info('更新输入框:', this.startLesson, this.endLesson);
    this.updateStats();
    this.saveCurrentConfig();
  }

  /**
   * 初始化按钮
   */
  initButtons() {
    // 开始学习
    const startLearningBtn = document.getElementById('startLearningBtn');
    startLearningBtn.addEventListener('click', () => {
      this.startLearning();
    });

    // 浏览模式
    const startBrowseBtn = document.getElementById('startBrowseBtn');
    startBrowseBtn.addEventListener('click', () => {
      this.startBrowse();
    });

    // 生成默写稿
    const generatePrintableBtn = document.getElementById('generatePrintableBtn');
    generatePrintableBtn.addEventListener('click', () => {
      this.generatePrintable();
    });

    // 排列方式变化时保存配置
    const studyModeSelect = document.getElementById('studyMode');
    if (studyModeSelect) {
      studyModeSelect.addEventListener('change', () => {
        this.saveCurrentConfig();
      });
    }

    // 单词数量自定义输入
    const wordCountSelect = document.getElementById('wordCount');
    const customWordCountInput = document.getElementById('customWordCount');
    wordCountSelect.addEventListener('change', () => {
      if (wordCountSelect.value === 'custom') {
        customWordCountInput.style.display = 'block';
        customWordCountInput.focus();
      } else {
        customWordCountInput.style.display = 'none';
      }
      this.saveCurrentConfig();
    });

    if (customWordCountInput) {
      customWordCountInput.addEventListener('input', () => {
        this.saveCurrentConfig();
      });
    }

    // 生成份数自定义输入
    const copyCountSelect = document.getElementById('copyCount');
    const customCopyCountInput = document.getElementById('customCopyCount');
    copyCountSelect.addEventListener('change', () => {
      if (copyCountSelect.value === 'custom') {
        customCopyCountInput.style.display = 'block';
        customCopyCountInput.focus();
      } else {
        customCopyCountInput.style.display = 'none';
      }
      this.saveCurrentConfig();
    });

    if (customCopyCountInput) {
      customCopyCountInput.addEventListener('input', () => {
        this.saveCurrentConfig();
      });
    }

    // 开始听写
    const startDictationBtn = document.getElementById('startDictationBtn');
    if (startDictationBtn) {
      startDictationBtn.addEventListener('click', () => {
        this.startDictation();
      });
    }

    // 词性筛选和单词数量变化时更新统计
    const posFilter = document.getElementById('posFilter');
    if (posFilter) {
      posFilter.addEventListener('change', () => {
        this.updateStats();
        this.saveCurrentConfig();
      });
    }

    const wordCount = document.getElementById('wordCount');
    if (wordCount) {
      wordCount.addEventListener('change', () => {
        this.updateStats();
      });
    }

    if (customWordCountInput) {
      customWordCountInput.addEventListener('input', () => {
        this.updateStats();
      });
    }
  }

  /**
   * 初始化听写设置
   */
  initDictationSettings() {
    // 恢复听写配置
    if (this.dictationConfig) {
      this.restoreDictationConfig(this.dictationConfig);
    }

    // 监听听写设置变化，更新预计时长
    const dictationAccent = document.getElementById('dictationAccent');
    const dictationPlayCount = document.getElementById('dictationPlayCount');
    const dictationInterval = document.getElementById('dictationInterval');
    const showHintsCheckbox = document.getElementById('showHints');
    const modeRadios = document.querySelectorAll('input[name="dictationMode"]');

    // 监听模式切换
    modeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        this.saveCurrentConfig();
      });
    });

    if (dictationAccent) {
      dictationAccent.addEventListener('change', () => {
        this.updateDictationEstimatedTime();
        this.saveCurrentConfig();
      });
    }

    if (dictationPlayCount) {
      const customPlayCountInput = document.getElementById('customDictationPlayCount');
      dictationPlayCount.addEventListener('change', () => {
        if (dictationPlayCount.value === 'custom') {
          customPlayCountInput.style.display = 'block';
          customPlayCountInput.focus();
        } else {
          customPlayCountInput.style.display = 'none';
        }
        this.updateDictationEstimatedTime();
        this.saveCurrentConfig();
      });

      if (customPlayCountInput) {
        customPlayCountInput.addEventListener('input', () => {
          this.updateDictationEstimatedTime();
          this.saveCurrentConfig();
        });
      }
    }

    if (dictationInterval) {
      const customIntervalInput = document.getElementById('customDictationInterval');
      dictationInterval.addEventListener('change', () => {
        if (dictationInterval.value === 'custom') {
          customIntervalInput.style.display = 'block';
          customIntervalInput.focus();
        } else {
          customIntervalInput.style.display = 'none';
        }
        this.updateDictationEstimatedTime();
        this.saveCurrentConfig();
      });

      if (customIntervalInput) {
        customIntervalInput.addEventListener('input', () => {
          this.updateDictationEstimatedTime();
          this.saveCurrentConfig();
        });
      }
    }

    if (showHintsCheckbox) {
      showHintsCheckbox.addEventListener('change', () => {
        this.saveCurrentConfig();
      });
    }

    // 监听词性提示和中文提示变化
    const showPosCheckbox = document.getElementById('dictationShowPos');
    if (showPosCheckbox) {
      showPosCheckbox.addEventListener('change', () => {
        this.saveCurrentConfig();
      });
    }

    const showMeaningCheckbox = document.getElementById('dictationShowMeaning');
    if (showMeaningCheckbox) {
      showMeaningCheckbox.addEventListener('change', () => {
        this.saveCurrentConfig();
      });
    }

    // 初始化预计时长
    this.updateDictationEstimatedTime();
  }

  /**
   * 恢复听写配置
   */
  restoreDictationConfig(config) {
    // 恢复模式
    if (config.mode) {
      const modeRadios = document.querySelectorAll('input[name="dictationMode"]');
      modeRadios.forEach(radio => {
        if (radio.value === config.mode) {
          radio.checked = true;
        }
      });
    }

    // 恢复播放次数
    if (config.playCount) {
      const playCountSelect = document.getElementById('dictationPlayCount');
      if (playCountSelect) {
        const standardValues = ['1', '2', '3'];
        if (standardValues.includes(String(config.playCount))) {
          playCountSelect.value = String(config.playCount);
        } else {
          playCountSelect.value = 'custom';
          const customInput = document.getElementById('customDictationPlayCount');
          if (customInput) {
            customInput.value = config.playCount;
            customInput.style.display = 'block';
          }
        }
      }
    }

    // 恢复间隔时间
    if (config.interval) {
      const intervalSelect = document.getElementById('dictationInterval');
      if (intervalSelect) {
        const standardValues = ['3', '5', '8', '10'];
        if (standardValues.includes(String(config.interval))) {
          intervalSelect.value = String(config.interval);
        } else {
          intervalSelect.value = 'custom';
          const customInput = document.getElementById('customDictationInterval');
          if (customInput) {
            customInput.value = config.interval;
            customInput.style.display = 'block';
          }
        }
      }
    }

    // 恢复发音
    if (config.accent) {
      const accentSelect = document.getElementById('dictationAccent');
      if (accentSelect) {
        accentSelect.value = config.accent;
      }
    }

    // 恢复提示选项
    if (config.showHints !== undefined) {
      const showHintsCheckbox = document.getElementById('showHints');
      if (showHintsCheckbox) {
        showHintsCheckbox.checked = config.showHints;
      }
    }

    // 恢复词性提示
    if (config.showPos !== undefined) {
      const showPosCheckbox = document.getElementById('dictationShowPos');
      if (showPosCheckbox) {
        showPosCheckbox.checked = config.showPos;
      }
    }

    // 恢复中文提示
    if (config.showMeaning !== undefined) {
      const showMeaningCheckbox = document.getElementById('dictationShowMeaning');
      if (showMeaningCheckbox) {
        showMeaningCheckbox.checked = config.showMeaning;
      }
    }
  }

  /**
   * 恢复其他配置
   */
  restoreOtherConfigs() {
    if (!this.lastConfig) return;

    // 恢复排列方式
    if (this.lastConfig.studyMode) {
      const studyModeSelect = document.getElementById('studyMode');
      if (studyModeSelect) {
        studyModeSelect.value = this.lastConfig.studyMode;
      }
    }

    // 恢复单词数量
    if (this.lastConfig.wordCount) {
      const wordCountSelect = document.getElementById('wordCount');
      if (wordCountSelect) {
        if (this.lastConfig.wordCount.startsWith('custom:')) {
          const customValue = this.lastConfig.wordCount.split(':')[1];
          wordCountSelect.value = 'custom';
          const customInput = document.getElementById('customWordCount');
          if (customInput) {
            customInput.value = customValue;
            customInput.style.display = 'block';
          }
        } else {
          wordCountSelect.value = this.lastConfig.wordCount;
        }
      }
    }

    // 恢复词性筛选
    if (this.lastConfig.posFilter) {
      const posFilterSelect = document.getElementById('posFilter');
      if (posFilterSelect) {
        posFilterSelect.value = this.lastConfig.posFilter;
      }
    }

    // 恢复生成份数
    if (this.lastConfig.copyCount) {
      const copyCountSelect = document.getElementById('copyCount');
      if (copyCountSelect) {
        if (this.lastConfig.copyCount.startsWith('custom:')) {
          const customValue = this.lastConfig.copyCount.split(':')[1];
          copyCountSelect.value = 'custom';
          const customInput = document.getElementById('customCopyCount');
          if (customInput) {
            customInput.value = customValue;
            customInput.style.display = 'block';
          }
        } else {
          copyCountSelect.value = this.lastConfig.copyCount;
        }
      }
    }
  }

  /**
   * 更新统计信息
   */
  async updateStats() {
    try {
      const words = await this.loadWords(true); // 应用所有筛选
      const count = words.length;
      document.getElementById('selectedCount').textContent = count;

      // 同时更新听写预计时长
      this.updateDictationEstimatedTime();
    } catch (error) {
      Logger.error('更新统计失败:', error);
      document.getElementById('selectedCount').textContent = '0';
    }
  }

  /**
   * 加载单词数据
   * @param {boolean} applyFilters - 是否应用词性筛选和数量限制
   */
  async loadWords(applyFilters = false) {
    const bookKey = this.selectedBook.toLowerCase();
    const baseUrl = import.meta.env.BASE_URL;
    const jsonUrl = `${baseUrl}words/${bookKey}.json`;

    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // 提取范围内的单词
    const startNum = parseInt(this.startLesson);
    const endNum = parseInt(this.endLesson);

    let words = [];
    data.lessons.forEach(lesson => {
      const lessonNum = parseInt(lesson.lessonNumber);
      if (lessonNum >= startNum && lessonNum <= endNum) {
        words.push(...lesson.words);
      }
    });

    // 应用筛选
    if (applyFilters) {
      // 词性筛选
      const posFilter = document.getElementById('posFilter');
      if (posFilter && posFilter.value !== 'all') {
        words = words.filter(word => word.pos === posFilter.value);
      }

      // 数量限制
      const wordCountSelect = document.getElementById('wordCount');
      if (wordCountSelect) {
        const wordCountValue = wordCountSelect.value;
        if (wordCountValue === 'custom') {
          const customWordCount = parseInt(document.getElementById('customWordCount').value);
          if (customWordCount && customWordCount > 0 && words.length > customWordCount) {
            words = words.slice(0, customWordCount);
          }
        } else if (wordCountValue !== 'all') {
          const count = parseInt(wordCountValue);
          if (words.length > count) {
            words = words.slice(0, count);
          }
        }
      }
    }

    return words;
  }

  /**
   * 开始学习
   */
  async startLearning() {
    try {
      // 保存当前配置
      this.saveCurrentConfig();

      const studyMode = document.getElementById('studyMode').value;
      const words = await this.loadWords(true); // 应用筛选和数量限制

      if (words.length === 0) {
        alert('没有可学习的单词');
        return;
      }

      // 准备数据
      const config = {
        book: this.selectedBook,
        startLesson: this.startLesson,
        endLesson: this.endLesson,
        studyMode
      };

      const result = {
        id: Date.now(),
        mode: 'learning',
        config,
        words,
        totalCount: words.length,
        generatedAt: Date.now()
      };

      // 保存到 sessionStorage
      sessionStorage.setItem('flashcard_data', JSON.stringify(result));

      // 跳转到卡片学习页
      location.href = 'flashcard.html';
    } catch (error) {
      Logger.error('开始学习失败:', error);
      alert('加载失败，请重试');
    }
  }

  /**
   * 浏览模式
   */
  async startBrowse() {
    try {
      // 保存当前配置
      this.saveCurrentConfig();

      const studyMode = document.getElementById('studyMode').value;
      const words = await this.loadWords(true); // 应用筛选和数量限制

      if (words.length === 0) {
        alert('没有可浏览的单词');
        return;
      }

      // 准备数据
      const config = {
        book: this.selectedBook,
        startLesson: this.startLesson,
        endLesson: this.endLesson,
        studyMode
      };

      const result = {
        id: Date.now(),
        mode: 'browse',
        config,
        words,
        totalCount: words.length,
        generatedAt: Date.now()
      };

      // 保存到 sessionStorage
      sessionStorage.setItem('browse_data', JSON.stringify(result));

      // 跳转到浏览页
      location.href = 'browse.html';
    } catch (error) {
      Logger.error('打开浏览模式失败:', error);
      alert('加载失败，请重试');
    }
  }

  /**
   * 生成默写稿
   */
  async generatePrintable() {
    try {
      // 保存当前配置
      this.saveCurrentConfig();

      const wordCountSelect = document.getElementById('wordCount').value;
      const studyMode = document.getElementById('studyMode').value; // 使用 studyMode 而不是 sortMode
      const copyCountSelect = document.getElementById('copyCount').value;

      // 获取实际的单词数量
      let wordCount = wordCountSelect;
      if (wordCountSelect === 'custom') {
        const customValue = parseInt(document.getElementById('customWordCount').value);
        if (!customValue || customValue < 1) {
          alert('请输入有效的单词数量（至少1个）');
          return;
        }
        wordCount = customValue;
      }

      // 获取实际的生成份数
      let copyCount = copyCountSelect === 'custom'
        ? parseInt(document.getElementById('customCopyCount').value)
        : parseInt(copyCountSelect);

      if (copyCountSelect === 'custom' && (!copyCount || copyCount < 1 || copyCount > 10)) {
        alert('请输入有效的生成份数（1-10份）');
        return;
      }

      let words = await this.loadWords(true); // 应用筛选和数量限制

      if (words.length === 0) {
        alert('没有可用的单词');
        return;
      }

      // 排序
      words = this.sortWords(words, studyMode);

      // 准备数据
      const config = {
        book: this.selectedBook,
        startLesson: this.startLesson,
        endLesson: this.endLesson,
        wordCount,
        sortMode: studyMode,
        copyCount
      };

      // 生成多份（如果需要）
      let wordCopies = [words];
      if (copyCount > 1) {
        wordCopies = this.generateMultipleCopies(words, copyCount);
      }

      const result = {
        mode: 'printable',
        config,
        words: wordCopies[0],
        wordCopies,
        allWords: words,
        totalCount: words.length,
        generatedAt: Date.now()
      };

      // 保存到 sessionStorage
      sessionStorage.setItem('printable_data', JSON.stringify(result));

      // 跳转到打印稿页
      location.href = 'printable.html';
    } catch (error) {
      Logger.error('生成默写稿失败:', error);
      alert('生成失败，请重试');
    }
  }

  /**
   * 排序单词
   */
  sortWords(words, mode) {
    const sorted = [...words];

    switch (mode) {
      case 'random':
        // 随机排列
        for (let i = sorted.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
        }
        break;

      case 'pos':
        // 按词性分组
        sorted.sort((a, b) => {
          const posA = a.pos || 'zzz';
          const posB = b.pos || 'zzz';
          return posA.localeCompare(posB);
        });
        break;

      case 'order':
      default:
        // 保持原顺序（已经是按课程顺序）
        break;
    }

    return sorted;
  }

  /**
   * 生成多份随机组合
   */
  generateMultipleCopies(words, copyCount) {
    const copies = [];
    for (let i = 0; i < copyCount; i++) {
      // 每份都重新随机
      const shuffled = [...words];
      for (let j = shuffled.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
      }
      copies.push(shuffled);
    }
    return copies;
  }

  /**
   * 更新听写预计时长
   */
  async updateDictationEstimatedTime() {
    const estimatedTimeEl = document.getElementById('dictationEstimatedTime');
    if (!estimatedTimeEl) return;

    try {
      // 获取单词数量
      const words = await this.loadWords(true);
      const wordCount = words.length;

      // 获取播放次数
      const playCountSelect = document.getElementById('dictationPlayCount');
      let playCount = 2;
      if (playCountSelect) {
        if (playCountSelect.value === 'custom') {
          const customPlayCount = parseInt(document.getElementById('customDictationPlayCount').value);
          playCount = customPlayCount || 2;
        } else {
          playCount = parseInt(playCountSelect.value);
        }
      }

      // 获取间隔时间
      const intervalSelect = document.getElementById('dictationInterval');
      let interval = 5;
      if (intervalSelect) {
        if (intervalSelect.value === 'custom') {
          const customInterval = parseInt(document.getElementById('customDictationInterval').value);
          interval = customInterval || 5;
        } else {
          interval = parseInt(intervalSelect.value);
        }
      }

      // 计算时长：单词数 × (播放次数 × 2秒 + 间隔秒数 + 5秒输入时间)
      const timePerWord = playCount * 2 + interval + 5;
      const totalSeconds = wordCount * timePerWord;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      const timeText = minutes > 0
        ? `~${minutes}分${seconds > 0 ? seconds + '秒' : ''}`
        : `~${seconds}秒`;

      estimatedTimeEl.textContent = timeText;
    } catch (error) {
      Logger.error('更新预计时长失败:', error);
      estimatedTimeEl.textContent = '~5分钟';
    }
  }

  /**
   * 开始听写
   */
  async startDictation() {
    try {
      // 保存当前配置
      this.saveCurrentConfig();

      // 获取配置 - 从单选按钮获取模式
      const mode = document.querySelector('input[name="dictationMode"]:checked')?.value || 'online';
      const studyMode = document.getElementById('studyMode').value;
      const posFilter = document.getElementById('posFilter').value;
      const wordCountSelect = document.getElementById('wordCount').value;
      const accent = document.getElementById('dictationAccent').value;

      // 获取播放次数
      const playCountSelect = document.getElementById('dictationPlayCount');
      let playCount = 2;
      if (playCountSelect.value === 'custom') {
        const customValue = parseInt(document.getElementById('customDictationPlayCount').value);
        if (!customValue || customValue < 1) {
          alert('请输入有效的播放次数（至少1次）');
          return;
        }
        playCount = customValue;
      } else {
        playCount = parseInt(playCountSelect.value);
      }

      // 获取间隔时间
      const intervalSelect = document.getElementById('dictationInterval');
      let interval = 5;
      if (intervalSelect.value === 'custom') {
        const customValue = parseInt(document.getElementById('customDictationInterval').value);
        if (!customValue || customValue < 1) {
          alert('请输入有效的间隔时间（至少1秒）');
          return;
        }
        interval = customValue;
      } else {
        interval = parseInt(intervalSelect.value);
      }

      const showPos = document.getElementById('dictationShowPos').checked;
      const showMeaning = document.getElementById('dictationShowMeaning').checked;

      // 获取实际的单词数量
      let wordCount = wordCountSelect;
      if (wordCountSelect === 'custom') {
        const customValue = parseInt(document.getElementById('customWordCount').value);
        if (!customValue || customValue < 1) {
          alert('请输入有效的单词数量（至少1个）');
          return;
        }
        wordCount = customValue;
      }

      // 加载单词数据（应用筛选）
      let words = await this.loadWords(true);

      if (words.length === 0) {
        alert('没有找到符合条件的单词');
        return;
      }

      // 应用学习模式（随机排列）
      if (studyMode === 'random') {
        this.shuffleArray(words);
      }

      // 准备数据
      const config = {
        book: this.selectedBook,
        startLesson: this.startLesson,
        endLesson: this.endLesson,
        wordCount: wordCount,
        posFilter: posFilter,
        studyMode: studyMode,
        accent: accent,
        playCount: playCount,
        interval: interval,
        showPos: showPos,
        showMeaning: showMeaning
      };

      const data = {
        mode: mode,
        config: config,
        words: words,
        totalCount: words.length,
        generatedAt: Date.now()
      };

      // 如果是线下模式，立即创建历史记录（和生成默写稿逻辑一样）
      if (mode === 'offline') {
        historyManager.addRecord({
          type: 'dictation',
          config: config,
          wordCount: words.length,
          // 保存完整的单词数据
          data: {
            words: words,
            totalCount: words.length
          },
          createdAt: Date.now()
        });
        Logger.info('线下听写历史记录已创建');
      }

      // 保存到 sessionStorage
      sessionStorage.setItem('dictation_data', JSON.stringify(data));

      // 跳转到对应页面
      if (mode === 'offline') {
        location.href = 'dictation-play.html';
      } else {
        location.href = 'dictation-practice.html';
      }
    } catch (error) {
      Logger.error('开始听写失败:', error);
      alert('加载失败，请重试');
    }
  }

  /**
   * 随机打乱数组
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * 初始化历史记录
   */
  initHistory() {
    this.currentHistoryFilter = 'all'; // 默认显示全部
    this.renderHistory();
    this.bindHistoryEvents();
  }

  /**
   * 渲染历史记录
   */
  renderHistory() {
    const historyGrid = document.getElementById('historyGrid');
    const historyEmpty = document.getElementById('historyEmpty');

    if (!historyGrid || !historyEmpty) {
      Logger.warn('历史记录容器未找到');
      return;
    }

    // 根据筛选条件获取记录
    let history = historyManager.getHistory();

    if (this.currentHistoryFilter === 'dictation') {
      history = history.filter(r => r.type === 'dictation');
    } else if (this.currentHistoryFilter === 'printable') {
      history = history.filter(r => r.type === 'printable');
    } else if (this.currentHistoryFilter === 'flashcard') {
      history = history.filter(r => r.type === 'flashcard');
    }
    // 'all' 显示所有类型

    // 按时间倒序排列
    history.sort((a, b) => {
      const timeA = a.completedAt || a.createdAt || 0;
      const timeB = b.completedAt || b.createdAt || 0;
      return timeB - timeA;
    });

    // 限制显示数量
    history = history.slice(0, 12);

    // 清空容器
    historyGrid.innerHTML = '';

    // 如果没有记录，显示空状态
    if (history.length === 0) {
      historyGrid.style.display = 'none';
      historyEmpty.style.display = 'block';
      return;
    }

    // 显示网格，隐藏空状态
    historyGrid.style.display = 'grid';
    historyEmpty.style.display = 'none';

    // 渲染每条记录
    history.forEach(record => {
      let card = null;
      if (record.type === 'dictation') {
        card = this.createDictationCard(record);
      } else if (record.type === 'printable') {
        card = this.createPrintableCard(record);
      } else if (record.type === 'flashcard') {
        card = this.createFlashcardCard(record);
      }

      if (card) {
        historyGrid.appendChild(card);
      }
    });
  }

  /**
   * 创建听写记录卡片
   */
  createDictationCard(record) {
    const card = document.createElement('div');
    card.className = 'history-card';

    // 检查记录结构：在线听写有 result，线下听写有 data
    const isOnline = !!record.result;
    const isOffline = !!record.data;

    if (!isOnline && !isOffline) {
      Logger.warn('历史记录结构不完整，跳过:', record);
      return null;
    }

    if (!record.config) {
      Logger.warn('历史记录缺少配置，跳过:', record);
      return null;
    }

    // 配置摘要
    const configSummary = `${record.config.book} L${record.config.startLesson}-${record.config.endLesson}`;

    // 相对时间
    const relativeTime = historyManager.formatRelativeTime(record.completedAt || record.createdAt);

    // 区分在线和线下模式
    if (isOnline) {
      // 在线听写：显示正确率和统计
      const duration = record.result.duration || 0;
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      const durationText = minutes > 0
        ? `${minutes}分${seconds}秒`
        : `${seconds}秒`;

      const totalWords = record.result.totalWords || 0;
      const accuracy = record.result.accuracy || 0;
      const correctCount = record.result.correctCount || 0;
      const wrongCount = record.result.wrongCount || 0;

      card.innerHTML = `
        <div class="history-card-header">
          <div class="history-card-title">
            🎯 ${configSummary}
          </div>
        </div>
        <div class="history-card-stats">
          ${totalWords}个单词 |
          正确率 ${accuracy}%
          (${correctCount}/${totalWords})
        </div>
        <div class="history-card-time">
          用时 ${durationText} | ${relativeTime}
        </div>
        <div class="history-card-actions">
          <button class="btn-detail" data-id="${record.id}">查看详情</button>
          <button class="btn-retry-all" data-id="${record.id}">全部重听写</button>
          ${wrongCount > 0 ?
            `<button class="btn-practice-wrong" data-id="${record.id}">练习错词 (${wrongCount})</button>` :
            ''}
        </div>
      `;
    } else {
      // 线下听写：只显示单词数量，没有正确率
      const totalWords = record.wordCount || 0;

      card.innerHTML = `
        <div class="history-card-header">
          <div class="history-card-title">
            📝 ${configSummary} (线下手写)
          </div>
        </div>
        <div class="history-card-stats">
          ${totalWords}个单词
        </div>
        <div class="history-card-time">
          ${relativeTime}
        </div>
        <div class="history-card-actions">
          <button class="btn-replay-offline" data-id="${record.id}">重新播放</button>
        </div>
      `;
    }

    return card;
  }

  /**
   * 创建默写稿记录卡片
   */
  createPrintableCard(record) {
    const card = document.createElement('div');
    card.className = 'history-card';

    // 检查记录结构是否完整
    if (!record.config) {
      Logger.warn('历史记录结构不完整，跳过:', record);
      return null;
    }

    // 配置摘要
    const configSummary = `${record.config.book} L${record.config.startLesson}-${record.config.endLesson}`;

    // 相对时间
    const relativeTime = historyManager.formatRelativeTime(record.createdAt);

    // 获取配置信息
    const wordCount = record.wordCount || 0;
    const copyCount = record.config.copyCount || 1;
    const sortMode = record.config.sortMode || 'sequential';

    // 排列方式文本
    const sortModeText = sortMode === 'random' ? '随机' : sortMode === 'pos' ? '按词性' : '顺序';

    card.innerHTML = `
      <div class="history-card-header">
        <div class="history-card-title">
          📝 ${configSummary}
        </div>
      </div>
      <div class="history-card-stats">
        ${wordCount}个单词 | ${copyCount}份 | ${sortModeText}排列
      </div>
      <div class="history-card-time">
        ${relativeTime}
      </div>
      <div class="history-card-actions">
        <button class="btn-view-printable" data-id="${record.id}">查看</button>
      </div>
    `;

    return card;
  }

  /**
   * 创建翻转卡记录卡片
   */
  createFlashcardCard(record) {
    const card = document.createElement('div');
    card.className = 'history-card';

    // 检查记录结构是否完整
    if (!record.config || !record.result) {
      Logger.warn('历史记录结构不完整，跳过:', record);
      return null;
    }

    // 配置摘要
    const configSummary = `${record.config.book} L${record.config.startLesson}-${record.config.endLesson}`;

    // 相对时间
    const relativeTime = historyManager.formatRelativeTime(record.completedAt || record.createdAt);

    // 获取统计信息
    const totalWords = record.result.totalWords || 0;
    const mastered = record.result.mastered || 0;
    const accuracy = record.result.accuracy || 0;
    const duration = record.result.duration || 0;
    const wrongCount = (record.result.review || 0) + (record.result.learning || 0);

    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationText = minutes > 0
      ? `${minutes}分${seconds}秒`
      : `${seconds}秒`;

    card.innerHTML = `
      <div class="history-card-header">
        <div class="history-card-title">
          📖 ${configSummary}
        </div>
      </div>
      <div class="history-card-stats">
        ${totalWords}个单词 |
        掌握率 ${accuracy}%
        (${mastered}/${totalWords})
      </div>
      <div class="history-card-time">
        用时 ${durationText} | ${relativeTime}
      </div>
      <div class="history-card-actions">
        <button class="btn-detail" data-id="${record.id}">查看详情</button>
        <button class="btn-retry-all-flashcard" data-id="${record.id}">重新学习</button>
        ${wrongCount > 0 ?
          `<button class="btn-practice-wrong-flashcard" data-id="${record.id}">复习错词 (${wrongCount})</button>` :
          ''}
      </div>
    `;

    return card;
  }

  /**
   * 绑定历史记录事件
   */
  bindHistoryEvents() {
    const historyGrid = document.getElementById('historyGrid');
    if (!historyGrid) return;

    // 筛选按钮事件
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // 更新按钮状态
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 更新筛选条件并重新渲染
        this.currentHistoryFilter = btn.dataset.filter;
        this.renderHistory();
      });
    });

    // 清空记录按钮事件
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        this.clearHistory();
      });
    }

    // 使用事件委托处理按钮点击
    historyGrid.addEventListener('click', (e) => {
      // 查看详情按钮
      const detailBtn = e.target.closest('.btn-detail');
      if (detailBtn) {
        e.stopPropagation();
        const recordId = parseInt(detailBtn.dataset.id);
        this.showDetail(recordId);
        return;
      }

      // 全部重听写按钮
      const retryAllBtn = e.target.closest('.btn-retry-all');
      if (retryAllBtn) {
        e.stopPropagation();
        const recordId = parseInt(retryAllBtn.dataset.id);
        this.retryAllWords(recordId);
        return;
      }

      // 练习错词按钮
      const practiceWrongBtn = e.target.closest('.btn-practice-wrong');
      if (practiceWrongBtn) {
        e.stopPropagation();
        const recordId = parseInt(practiceWrongBtn.dataset.id);
        this.practiceWrongWords(recordId);
        return;
      }

      // 查看默写稿按钮
      const viewPrintableBtn = e.target.closest('.btn-view-printable');
      if (viewPrintableBtn) {
        e.stopPropagation();
        const recordId = parseInt(viewPrintableBtn.dataset.id);
        this.viewPrintable(recordId);
        return;
      }

      // 重新播放线下听写按钮
      const replayOfflineBtn = e.target.closest('.btn-replay-offline');
      if (replayOfflineBtn) {
        e.stopPropagation();
        const recordId = parseInt(replayOfflineBtn.dataset.id);
        this.replayOfflineDictation(recordId);
        return;
      }

      // 全部重新学习翻转卡按钮
      const retryAllFlashcardBtn = e.target.closest('.btn-retry-all-flashcard');
      if (retryAllFlashcardBtn) {
        e.stopPropagation();
        const recordId = parseInt(retryAllFlashcardBtn.dataset.id);
        this.retryAllFlashcard(recordId);
        return;
      }

      // 复习错词翻转卡按钮
      const practiceWrongFlashcardBtn = e.target.closest('.btn-practice-wrong-flashcard');
      if (practiceWrongFlashcardBtn) {
        e.stopPropagation();
        const recordId = parseInt(practiceWrongFlashcardBtn.dataset.id);
        this.reviewWrongFlashcard(recordId);
        return;
      }
    });
  }

  /**
   * 查看详情
   */
  showDetail(recordId) {
    const history = historyManager.getHistory();
    const record = history.find(r => r.id === recordId);

    if (!record || !record.result) {
      Logger.warn('未找到历史记录:', recordId);
      alert('记录不存在');
      return;
    }

    // 根据记录类型跳转到不同页面
    if (record.type === 'flashcard') {
      // 翻转卡学习记录
      const resultData = {
        config: record.config,
        result: record.result,
        wordCount: record.wordCount,
        createdAt: record.createdAt,
        completedAt: record.completedAt,
        isFromHistory: true  // 标记为查看历史记录
      };

      // 保存到 sessionStorage 并跳转到翻转卡结果页
      sessionStorage.setItem('flashcard_result', JSON.stringify(resultData));
      location.href = 'flashcard-result.html';
    } else if (record.type === 'dictation') {
      // 听写记录
      const resultData = {
        config: record.config,
        answers: record.result.answers.map(a => ({
          word: a.word,
          userAnswer: a.userAnswer,
          isCorrect: a.isCorrect,
          meaning: a.meaning,
          pos: a.pos,
          phonetic: a.phonetic
        })),
        stats: {
          total: record.result.totalWords,
          correct: record.result.correctCount,
          wrong: record.result.wrongCount,
          accuracy: record.result.accuracy,
          duration: record.result.duration
        },
        mode: record.config.mode || 'online',
        words: record.result.answers.map(a => ({
          word: a.word,
          meaning: a.meaning,
          pos: a.pos,
          phonetic: a.phonetic
        })),
        startedAt: record.createdAt,
        completedAt: record.completedAt,
        isFromHistory: true  // 标记为查看历史记录
      };

      // 保存到 sessionStorage 并跳转到听写结果页
      sessionStorage.setItem('dictation_result', JSON.stringify(resultData));
      location.href = 'dictation-result.html';
    } else {
      Logger.warn('不支持的记录类型:', record.type);
      alert('不支持查看此类型的详情');
    }
  }

  /**
   * 查看默写稿
   */
  viewPrintable(recordId) {
    const history = historyManager.getHistory();
    const record = history.find(r => r.id === recordId);

    if (!record || !record.data) {
      Logger.warn('未找到历史记录或数据:', recordId);
      alert('记录不存在或数据已丢失');
      return;
    }

    Logger.info('查看默写稿:', record);

    // 恢复完整的打印稿数据
    const result = {
      mode: 'printable',
      config: record.config,
      words: record.data.words,
      wordCopies: record.data.wordCopies,
      allWords: record.data.allWords,
      totalCount: record.data.totalCount,
      generatedAt: record.createdAt,
      isFromHistory: true  // 标记为查看历史记录
    };

    // 保存到 sessionStorage
    sessionStorage.setItem('printable_data', JSON.stringify(result));

    // 跳转到打印稿页
    location.href = 'printable.html';
  }

  /**
   * 全部重听写
   */
  retryAllWords(recordId) {
    const history = historyManager.getHistory();
    const record = history.find(r => r.id === recordId);

    if (!record || !record.result || !record.result.answers) {
      Logger.warn('未找到历史记录或答题数据:', recordId);
      alert('记录不存在');
      return;
    }

    Logger.info('全部重听写:', record.result.answers.length, '个单词');

    // 准备听写数据 - 使用所有单词
    const data = {
      mode: record.config.mode || 'online',
      config: {
        ...record.config,
        wordCount: record.result.answers.length
      },
      words: record.result.answers.map(a => ({
        word: a.word,
        meaning: a.meaning || '',
        pos: a.pos || '',
        phonetic: a.phonetic || []
      })),
      totalCount: record.result.answers.length,
      generatedAt: Date.now(),
      isFromHistory: true  // 标记为查看历史记录
    };

    // 保存到 sessionStorage
    sessionStorage.setItem('dictation_data', JSON.stringify(data));

    // 跳转到听写页面
    if (data.mode === 'offline') {
      location.href = 'dictation-play.html';
    } else {
      location.href = 'dictation-practice.html';
    }
  }

  /**
   * 练习错词
   */
  practiceWrongWords(recordId) {
    const history = historyManager.getHistory();
    const record = history.find(r => r.id === recordId);

    if (!record || !record.result || !record.result.answers) {
      Logger.warn('未找到历史记录或答题数据:', recordId);
      alert('记录不存在');
      return;
    }

    // 提取错误的单词
    const wrongAnswers = record.result.answers.filter(a => !a.isCorrect);

    if (wrongAnswers.length === 0) {
      alert('没有错误的单词');
      return;
    }

    Logger.info('练习错词:', wrongAnswers.length, '个');

    // 准备听写数据
    const data = {
      mode: record.config.mode || 'online',
      config: {
        ...record.config,
        wordCount: wrongAnswers.length
      },
      words: wrongAnswers.map(a => ({
        word: a.word,
        meaning: a.meaning || '',
        pos: a.pos || '',
        phonetic: a.phonetic || []
      })),
      totalCount: wrongAnswers.length,
      generatedAt: Date.now(),
      isFromHistory: true  // 标记为查看历史记录
    };

    // 保存到 sessionStorage
    sessionStorage.setItem('dictation_data', JSON.stringify(data));

    // 跳转到听写页面
    if (data.mode === 'offline') {
      location.href = 'dictation-play.html';
    } else {
      location.href = 'dictation-practice.html';
    }
  }

  /**
   * 重新播放线下听写
   */
  replayOfflineDictation(recordId) {
    const history = historyManager.getHistory();
    const record = history.find(r => r.id === recordId);

    if (!record || !record.data) {
      Logger.warn('未找到历史记录或数据:', recordId);
      alert('记录不存在或数据已丢失');
      return;
    }

    Logger.info('重新播放线下听写:', record);

    // 恢复完整的听写数据
    const data = {
      mode: 'offline',
      config: record.config,
      words: record.data.words,
      totalCount: record.data.totalCount,
      generatedAt: record.createdAt,
      isFromHistory: true  // 标记为查看历史记录
    };

    // 保存到 sessionStorage
    sessionStorage.setItem('dictation_data', JSON.stringify(data));

    // 跳转到播放页
    location.href = 'dictation-play.html';
  }

  /**
   * 全部重新学习翻转卡
   */
  retryAllFlashcard(recordId) {
    const history = historyManager.getHistory();
    const record = history.find(r => r.id === recordId);

    if (!record || !record.result || !record.result.ratings) {
      Logger.warn('未找到历史记录或评价数据:', recordId);
      alert('记录不存在');
      return;
    }

    Logger.info('重新学习翻转卡:', record.result.ratings.length, '个单词');

    // 准备学习数据 - 使用所有单词
    const data = {
      id: Date.now(),
      mode: 'learning',
      config: record.config,
      words: record.result.ratings.map(r => r.word),
      totalCount: record.result.ratings.length,
      generatedAt: Date.now(),
      isFromHistory: true  // 标记为查看历史记录
    };

    // 保存到 sessionStorage
    sessionStorage.setItem('flashcard_data', JSON.stringify(data));

    // 跳转到翻转卡学习页
    location.href = 'flashcard.html';
  }

  /**
   * 复习错词翻转卡
   */
  reviewWrongFlashcard(recordId) {
    const history = historyManager.getHistory();
    const record = history.find(r => r.id === recordId);

    if (!record || !record.result || !record.result.ratings) {
      Logger.warn('未找到历史记录或评价数据:', recordId);
      alert('记录不存在');
      return;
    }

    // 提取错误的单词（模糊 + 不认识）
    const wrongRatings = record.result.ratings.filter(r => r.level === 0 || r.level === 1);

    if (wrongRatings.length === 0) {
      alert('没有需要复习的单词');
      return;
    }

    Logger.info('复习错词翻转卡:', wrongRatings.length, '个');

    // 准备学习数据
    const data = {
      id: Date.now(),
      mode: 'learning',
      config: record.config,
      words: wrongRatings.map(r => r.word),
      totalCount: wrongRatings.length,
      generatedAt: Date.now(),
      isFromHistory: true  // 标记为查看历史记录
    };

    // 保存到 sessionStorage
    sessionStorage.setItem('flashcard_data', JSON.stringify(data));

    // 跳转到翻转卡学习页
    location.href = 'flashcard.html';
  }

  /**
   * 清空所有练习记录
   */
  clearHistory() {
    const history = historyManager.getHistory();

    if (history.length === 0) {
      alert('没有练习记录');
      return;
    }

    // 确认对话框
    const confirmed = confirm(
      `确定要清空所有练习记录吗？\n\n` +
      `当前共有 ${history.length} 条记录，包括：\n` +
      `• 翻转卡学习\n` +
      `• 听写记录\n` +
      `• 默写稿记录\n\n` +
      `此操作不可恢复！`
    );

    if (!confirmed) {
      return;
    }

    // 清空历史记录
    historyManager.clearHistory();
    Logger.info('已清空所有练习记录');

    // 重新渲染
    this.renderHistory();

    // 提示成功
    alert('已清空所有练习记录');
  }
}

// 启动应用
new VocabularyApp();

// 渲染版本信息
renderVersion();
