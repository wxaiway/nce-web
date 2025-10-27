import { Logger } from '../utils/logger.js';

/**
 * 课程导航管理器
 */
export class LessonNavigation {
  constructor(book, filename) {
    this.book = book;
    this.filename = filename;
  }

  /**
   * 设置课程导航（上一课/下一课）
   */
  async setupNavigation() {
    const prevBtn = document.getElementById('prevLesson');
    const nextBtn = document.getElementById('nextLesson');

    if (!prevBtn || !nextBtn) return;

    try {
      const response = await fetch(import.meta.env.BASE_URL + 'static/data.json');
      const data = await response.json();
      const bookNum = this.book.replace('NCE', '');
      const lessons = data[bookNum] || [];

      const currentIndex = lessons.findIndex((l) => l.filename === this.filename);

      if (currentIndex === -1) {
        prevBtn.hidden = true;
        nextBtn.hidden = true;
        return;
      }

      // 上一课
      if (currentIndex > 0) {
        const prevLesson = lessons[currentIndex - 1];
        prevBtn.href = `lesson.html#${this.book}/${prevLesson.filename}`;
        prevBtn.hidden = false;
        prevBtn.onclick = (e) => {
          e.preventDefault();
          location.href = `lesson.html#${this.book}/${prevLesson.filename}`;
          location.reload();
        };
      } else {
        prevBtn.hidden = true;
      }

      // 下一课
      if (currentIndex < lessons.length - 1) {
        const nextLesson = lessons[currentIndex + 1];
        nextBtn.href = `lesson.html#${this.book}/${nextLesson.filename}`;
        nextBtn.hidden = false;
        nextBtn.onclick = (e) => {
          e.preventDefault();
          location.href = `lesson.html#${this.book}/${nextLesson.filename}`;
          location.reload();
        };
      } else {
        nextBtn.hidden = true;
      }
    } catch (error) {
      Logger.error('设置课程导航失败:', error);
      prevBtn.hidden = true;
      nextBtn.hidden = true;
    }
  }
}
