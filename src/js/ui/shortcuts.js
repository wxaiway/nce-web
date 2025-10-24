import { Toast } from '../utils/toast.js';
import { FocusTrap } from '../utils/focus-trap.js';

/**
 * 全局快捷键管理
 */
export class ShortcutManager {
  constructor(player) {
    this.player = player;
    this.helpPanel = document.getElementById('helpPanel');
    this.helpOverlay = document.getElementById('helpOverlay');
    this.focusTrapCleanup = null;
    this.init();
  }

  init() {
    document.addEventListener('keydown', (e) => this.handleKeydown(e));
    this.initHelpPanel();
  }

  /**
   * 初始化帮助面板
   */
  initHelpPanel() {
    if (!this.helpPanel || !this.helpOverlay) return;

    // 帮助按钮
    document.getElementById('helpBtn')?.addEventListener('click', () => this.openHelp());

    // 关闭按钮
    document.getElementById('helpClose')?.addEventListener('click', () => this.closeHelp());

    // 点击遮罩关闭
    this.helpOverlay.addEventListener('click', () => this.closeHelp());

    // ESC 键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.helpPanel.hidden) {
        this.closeHelp();
      }
    });
  }

  /**
   * 打开帮助面板
   */
  openHelp() {
    this.helpOverlay.hidden = false;
    this.helpPanel.hidden = false;

    requestAnimationFrame(() => {
      this.helpOverlay.classList.add('show');
      this.helpPanel.classList.add('show');
    });

    document.body.style.overflow = 'hidden';

    // 激活焦点陷阱
    this.focusTrapCleanup = FocusTrap.activate(this.helpPanel);
  }

  /**
   * 关闭帮助面板
   */
  closeHelp() {
    this.helpOverlay.classList.remove('show');
    this.helpPanel.classList.remove('show');

    setTimeout(() => {
      this.helpOverlay.hidden = true;
      this.helpPanel.hidden = true;
    }, 200);

    document.body.style.overflow = '';

    // 清理焦点陷阱
    if (this.focusTrapCleanup) {
      this.focusTrapCleanup();
      this.focusTrapCleanup = null;
    }
  }

  handleKeydown(e) {
    // 忽略输入框中的按键
    if (this.isInputElement(e.target)) return;

    // ?/H：显示帮助
    if (e.key === '?' || e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      this.openHelp();
      return;
    }

    // 空格：播放/暂停
    if (e.code === 'Space') {
      e.preventDefault();
      this.togglePlayPause();
      return;
    }

    // R：重播当前句
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      this.replayCurrent();
      return;
    }

    // M：静音/取消静音
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      this.toggleMute();
      return;
    }

    // 1-9：跳转到 10%-90%
    if (e.key >= '1' && e.key <= '9' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const percent = parseInt(e.key) * 10;
      this.jumpToPercent(percent);
      return;
    }

    // Shift + 左箭头：后退 5 秒
    if (e.key === 'ArrowLeft' && e.shiftKey) {
      e.preventDefault();
      this.seek(-5);
      return;
    }

    // Shift + 右箭头：前进 5 秒
    if (e.key === 'ArrowRight' && e.shiftKey) {
      e.preventDefault();
      this.seek(5);
      return;
    }

    // 右箭头/D：下一句（无修饰键）
    if ((e.key === 'ArrowRight' || e.key === 'd') && !e.shiftKey) {
      e.preventDefault();
      this.nextSentence();
      return;
    }

    // 左箭头/A：上一句（无修饰键）
    if ((e.key === 'ArrowLeft' || e.key === 'a') && !e.shiftKey) {
      e.preventDefault();
      this.prevSentence();
      return;
    }

    // 上箭头：音量增加
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.volumeUp();
      return;
    }

    // 下箭头：音量减少
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.volumeDown();
      return;
    }
  }

  /**
   * 检查是否为输入元素
   */
  isInputElement(element) {
    const tagName = element.tagName;
    return (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      element.isContentEditable
    );
  }

  /**
   * 播放/暂停切换
   */
  togglePlayPause() {
    if (this.player.audio.paused) {
      this.player.audio.play().catch(() => {});
    } else {
      this.player.pause();
    }
  }

  /**
   * 重播当前句
   */
  replayCurrent() {
    if (this.player.currentIdx >= 0) {
      this.player.playSegment(this.player.currentIdx);
    }
  }

  /**
   * 下一句
   */
  nextSentence() {
    const nextIdx = Math.min(this.player.currentIdx + 1, this.player.items.length - 1);
    this.player.playSegment(nextIdx);
  }

  /**
   * 上一句
   */
  prevSentence() {
    const prevIdx = Math.max(this.player.currentIdx - 1, 0);
    this.player.playSegment(prevIdx);
  }

  /**
   * 音量增加
   */
  volumeUp() {
    const newVolume = Math.min(1, this.player.audio.volume + 0.1);
    this.player.audio.volume = newVolume;
    this.showVolumeToast(newVolume);
  }

  /**
   * 音量减少
   */
  volumeDown() {
    const newVolume = Math.max(0, this.player.audio.volume - 0.1);
    this.player.audio.volume = newVolume;
    this.showVolumeToast(newVolume);
  }

  /**
   * 显示音量提示（带图标和进度条）
   */
  showVolumeToast(volume) {
    const percentage = Math.round(volume * 100);
    const icon = volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊';
    const barLength = 10;
    const filled = Math.floor(volume * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    Toast.info(`${icon} ${bar} ${percentage}%`, 800);
  }

  /**
   * 静音/取消静音
   */
  toggleMute() {
    this.player.audio.muted = !this.player.audio.muted;
    Toast.info(this.player.audio.muted ? '已静音' : '已取消静音', 1000);
  }

  /**
   * 跳转到指定百分比位置
   */
  jumpToPercent(percent) {
    const duration = this.player.audio.duration;
    if (!duration || isNaN(duration)) return;

    const targetTime = (duration * percent) / 100;
    this.player.audio.currentTime = targetTime;
    Toast.info(`跳转到 ${percent}%`, 1000);
  }

  /**
   * 快进/快退指定秒数
   */
  seek(seconds) {
    const currentTime = this.player.audio.currentTime;
    const duration = this.player.audio.duration;

    if (!duration || isNaN(duration)) return;

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    this.player.audio.currentTime = newTime;

    const direction = seconds > 0 ? '前进' : '后退';
    Toast.info(`${direction} ${Math.abs(seconds)} 秒`, 1000);
  }
}
