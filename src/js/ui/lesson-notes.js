import { marked } from 'marked';
import { Logger } from '../utils/logger.js';

/**
 * 讲解内容管理器
 */
export class LessonNotes {
  constructor(lessonKey) {
    this.lessonKey = lessonKey;
    this.notesLoaded = false;
  }

  /**
   * 加载讲解内容
   */
  async loadNotes() {
    const notesContent = document.getElementById('notesContent');

    try {
      // 先尝试加载课程专属的 Markdown 文件
      let mdUrl = `${this.lessonKey}.md`;
      let response = await fetch(mdUrl);

      // 如果不存在，加载默认的 default.md
      if (!response.ok && response.status === 404) {
        mdUrl = 'default.md';
        response = await fetch(mdUrl);
      }

      if (!response.ok) {
        throw new Error('加载失败');
      }

      const markdown = await response.text();
      const html = marked.parse(markdown);
      notesContent.innerHTML = html;
      this.notesLoaded = true;
    } catch (error) {
      Logger.error('讲解加载失败:', error);
      notesContent.innerHTML = `
        <div class="empty-state">
          <p>⚠️ 讲解内容加载失败</p>
          <button onclick="location.reload()" class="control-btn">重试</button>
        </div>
      `;
    }
  }

  /**
   * 检查是否已加载
   * @returns {boolean}
   */
  isLoaded() {
    return this.notesLoaded;
  }
}
