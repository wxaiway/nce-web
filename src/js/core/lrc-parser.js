/**
 * LRC 字幕解析器
 * 支持两种格式：
 * 1. 同行双语：[00:12.34]English | 中文
 * 2. 堆叠格式：[00:12.34]English \n [00:12.34]中文
 */
export class LRCParser {
  static LINE_RE = /^((?:\[\d+:\d+(?:\.\d+)?\])+)(.*)$/;
  static META_RE = /^\[(al|ar|ti|by):(.+)\]$/i;

  /**
   * 解析 LRC 文本
   * @param {string} text - LRC 文本内容
   * @returns {Object} { meta, items }
   */
  static parse(text) {
    const rows = text.replace(/\r/g, '').split('\n');
    const meta = { al: '', ar: '', ti: '', by: '' };
    const items = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i].trim();
      if (!raw) continue;

      // 解析元数据
      const metaMatch = raw.match(this.META_RE);
      if (metaMatch) {
        meta[metaMatch[1].toLowerCase()] = metaMatch[2].trim();
        continue;
      }

      // 解析时间戳和内容
      const lineMatch = raw.match(this.LINE_RE);
      if (!lineMatch) continue;

      const tags = lineMatch[1];
      const start = this.timeTagsToSeconds(tags);
      const { en, cn, skipNext } = this.parseContent(lineMatch[2], rows[i + 1], tags);

      if (skipNext) i++; // 跳过下一行（堆叠格式）

      items.push({ start, en, cn, end: 0 });
    }

    // 计算每句的结束时间
    for (let i = 0; i < items.length; i++) {
      items[i].end = i + 1 < items.length ? items[i + 1].start : 0;
    }

    return { meta, items };
  }

  /**
   * 时间戳转秒数
   * @param {string} tags - 时间戳 [mm:ss.xx]
   * @returns {number} 秒数
   */
  static timeTagsToSeconds(tags) {
    const match = /\[(\d+):(\d+(?:\.\d+)?)\]/.exec(tags);
    if (!match) return 0;
    return parseInt(match[1], 10) * 60 + parseFloat(match[2]);
  }

  /**
   * 解析内容（支持双语）
   */
  static parseContent(body, nextLine, tags) {
    let en = body.trim();
    let cn = '';
    let skipNext = false;

    // 同行双语格式：English | 中文
    if (body.includes('|')) {
      const parts = body.split('|');
      en = parts[0].trim();
      cn = (parts[1] || '').trim();
    }
    // 堆叠格式：检查下一行是否为中文
    else if (nextLine) {
      const nextMatch = nextLine.trim().match(this.LINE_RE);
      if (nextMatch && nextMatch[1] === tags) {
        const text2 = nextMatch[2].trim();
        if (this.hasCJK(text2)) {
          cn = text2;
          skipNext = true;
        }
      }
    }

    return { en, cn, skipNext };
  }

  /**
   * 检测是否包含中文字符
   */
  static hasCJK(text) {
    return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(text);
  }
}
