import { DOWNLOAD_RESOURCES } from './data/download-resources.js';
import { renderVersion } from './utils/version.js';

const container = document.getElementById('downloadResources');
const template = document.getElementById('downloadCard');
const icons = { 'fa-file-pdf': '📄', 'fa-book-open': '📚' };

document.getElementById('resourceCount').textContent = `${DOWNLOAD_RESOURCES.length} 项资源`;

for (const resource of DOWNLOAD_RESOURCES) {
  const card = template.content.firstElementChild.cloneNode(true);
  const title = card.querySelector('.download-title');
  title.id = `download-${resource.id}`;
  title.textContent = resource.title;
  card.setAttribute('aria-labelledby', title.id);
  card.querySelector('.download-icon').textContent = icons[resource.icon] || '🎬';
  card.querySelector('.download-category').textContent = resource.category;
  card.querySelector('.download-description').textContent = resource.description;
  card.querySelector('.download-share-name').textContent = `网盘分享：${resource.shareName}`;
  card.querySelector('.download-code').textContent = resource.extractionCode;
  card.querySelector('.download-link').href = resource.url;

  const copyButton = card.querySelector('.download-copy');
  const status = card.querySelector('.download-status');
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resource.extractionCode);
      copyButton.textContent = '已复制';
      status.textContent = '提取码已复制，可前往百度网盘使用。';
    } catch {
      copyButton.textContent = '复制提取码';
      status.textContent = '复制未成功，请长按或选中上方提取码手动复制。';
    }
  });
  container.append(card);
}

renderVersion();
