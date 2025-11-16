import { Logger } from './logger.js';

/**
 * PDF 字体加载工具
 * 提供统一的字体加载和缓存机制
 */
export class FontLoader {
  // 内存缓存
  static fontCache = null;
  static fontLoading = null;

  /**
   * 加载中文字体
   * @returns {Promise<string>} base64 编码的字体数据
   */
  static async loadFont() {
    // 1. 如果已缓存，直接返回
    if (FontLoader.fontCache) {
      Logger.info('使用缓存的字体');
      return FontLoader.fontCache;
    }

    // 2. 如果正在加载，等待加载完成
    if (FontLoader.fontLoading) {
      Logger.info('等待字体加载完成...');
      return FontLoader.fontLoading;
    }

    // 3. 开始加载字体
    FontLoader.fontLoading = (async () => {
      try {
        const fontPath = import.meta.env.BASE_URL + 'fonts/FangZhengKaiTiJianTi-1.ttf';
        Logger.info('正在加载字体:', fontPath);

        const response = await fetch(fontPath);
        if (!response.ok) {
          throw new Error(`字体加载失败: ${response.status} ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          const sizeMB = (parseInt(contentLength, 10) / 1024 / 1024).toFixed(2);
          Logger.info(`字体文件大小: ${sizeMB}MB`);
        }

        const arrayBuffer = await response.arrayBuffer();
        Logger.info('字体下载完成，开始转换为 base64...');

        // 转换为 base64（分块处理避免栈溢出）
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 0x8000; // 32KB chunks
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          binary += String.fromCharCode.apply(null, chunk);
        }
        const base64 = btoa(binary);
        Logger.info('base64 转换完成');

        // 缓存字体
        FontLoader.fontCache = base64;
        FontLoader.fontLoading = null;

        return base64;
      } catch (error) {
        FontLoader.fontLoading = null;
        Logger.error('字体加载失败:', error);
        throw error;
      }
    })();

    return FontLoader.fontLoading;
  }

  /**
   * 清除字体缓存
   */
  static clearCache() {
    FontLoader.fontCache = null;
    FontLoader.fontLoading = null;
    Logger.info('字体缓存已清除');
  }
}
