/**
 * 应用版本信息工具
 * 版本信息在构建时由 Vite 注入
 */

// 这些全局常量由 vite.config.js 在构建时注入
// eslint-disable-next-line no-undef
export const version = __APP_VERSION__;
// eslint-disable-next-line no-undef
export const gitCommit = __GIT_COMMIT__;
// eslint-disable-next-line no-undef
export const buildTime = __BUILD_TIME__;

/**
 * 获取完整版本信息
 */
export function getVersionInfo() {
  return {
    version,
    gitCommit,
    buildTime
  };
}

/**
 * 获取格式化的版本字符串
 * @returns {string} 格式: v2.0.0 (3db9156)
 */
export function getVersionString() {
  return `v${version} (${gitCommit})`;
}

/**
 * 渲染版本信息到页脚
 * @param {string} containerId - 容器元素 ID
 */
export function renderVersion(containerId = 'appVersion') {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.textContent = getVersionString();
}
