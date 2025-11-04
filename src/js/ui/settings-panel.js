import { Storage } from '../utils/storage.js';
import { FocusTrap } from '../utils/focus-trap.js';
import { Toast } from '../utils/toast.js';

/**
 * 设置面板管理
 */
export class SettingsPanel {
  constructor(player, wakeLockManager) {
    this.player = player;
    this.wakeLockManager = wakeLockManager;
    this.panel = document.getElementById('settingsPanel');
    this.overlay = document.getElementById('settingsOverlay');
    this.focusTrapCleanup = null;

    // 播放模式映射表
    this.playModeMapping = {
      'single': { readMode: 'single', loopMode: 'none', autoNext: false },
      'single-loop': { readMode: 'single', loopMode: 'single', autoNext: false },
      'continuous': { readMode: 'continuous', loopMode: 'none', autoNext: false },
      'continuous-loop': { readMode: 'continuous', loopMode: 'all', autoNext: false },
      'continuous-next': { readMode: 'continuous', loopMode: 'none', autoNext: true }
    };

    if (!this.panel || !this.overlay) return;

    this.init();
  }

  init() {
    // 打开/关闭按钮
    document.getElementById('settingsBtn')?.addEventListener('click', () => this.open());
    document.getElementById('settingsClose')?.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', () => this.close());

    // ESC 键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.panel.hidden) {
        this.close();
      }
    });

    // 播放速度控制（设置面板）
    this.initSpeedControlInPanel();

    // 学习方式控制（新的统一设置）
    this.initPlayModeControl();

    // 自动跟随控制
    this.initAutoScrollControl();

    // 屏幕常亮控制（仅手机端）
    if (this.wakeLockManager) {
      this.initKeepScreenOnControl();
      // 初始化图标状态（确保PC端隐藏）
      this.updateWakeLockIcon();
    }

    // 恢复默认按钮
    this.initResetButton();

    // 重置播放器按钮
    this.initResetPlayerButton();
  }

  /**
   * 播放速度控制（设置面板）
   */
  initSpeedControlInPanel() {
    const speedBtns = document.querySelectorAll('[data-speed]');
    const savedRate = Storage.get('audioPlaybackRate', 1.0);

    // 设置初始速度
    this.player.setPlaybackRate(savedRate);

    // 设置初始激活状态（互斥选择）
    speedBtns.forEach((btn) => {
      const rate = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', rate === savedRate);
    });

    // 添加点击事件
    speedBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const newRate = parseFloat(btn.dataset.speed);
        this.player.setPlaybackRate(newRate);
        Storage.set('audioPlaybackRate', newRate);

        // 更新按钮状态（互斥选择）
        speedBtns.forEach((b) => b.classList.toggle('active', b === btn));
      });
    });
  }

  /**
   * 学习方式控制（新的统一设置）
   */
  initPlayModeControl() {
    // 迁移旧设置到新格式
    const savedPlayMode = this.migrateOldSettings();

    // 获取所有播放模式选项
    const modeOptions = document.querySelectorAll('input[name="playMode"]');

    // 设置初始选中状态
    modeOptions.forEach((option) => {
      if (option.value === savedPlayMode) {
        option.checked = true;
      }
    });

    // 应用初始设置到播放器
    const initialSettings = this.playModeMapping[savedPlayMode];
    this.player.setReadMode(initialSettings.readMode);
    this.player.setLoopMode(initialSettings.loopMode);
    Storage.set('autoNext', initialSettings.autoNext);

    // 添加变更事件
    modeOptions.forEach((option) => {
      option.addEventListener('change', () => {
        if (option.checked) {
          const settings = this.playModeMapping[option.value];

          // 应用设置
          this.player.setReadMode(settings.readMode);
          this.player.setLoopMode(settings.loopMode);
          Storage.set('autoNext', settings.autoNext);

          // 保存当前播放模式
          Storage.set('playMode', option.value);
        }
      });
    });
  }

  /**
   * 迁移旧设置到新格式
   */
  migrateOldSettings() {
    // 检查是否已有新格式的设置
    const savedPlayMode = Storage.get('playMode');
    if (savedPlayMode) {
      return savedPlayMode;
    }

    // 读取旧设置
    const readMode = Storage.get('readMode', 'continuous');
    const loopMode = Storage.get('loopMode', 'none');
    const autoNext = Storage.get('autoNext', false);

    // 转换为新格式
    let playMode;
    if (readMode === 'single') {
      playMode = loopMode === 'single' ? 'single-loop' : 'single';
    } else {
      if (autoNext) {
        playMode = 'continuous-next';
      } else if (loopMode === 'all') {
        playMode = 'continuous-loop';
      } else {
        playMode = 'continuous';
      }
    }

    // 保存新格式
    Storage.set('playMode', playMode);
    return playMode;
  }

  /**
   * 自动跟随控制
   */
  initAutoScrollControl() {
    const toggle = document.getElementById('autoScrollToggle');
    if (!toggle) return;

    const saved = Storage.get('autoScroll', true);
    toggle.checked = saved;

    toggle.addEventListener('change', () => {
      Storage.set('autoScroll', toggle.checked);
    });
  }


  /**
   * 屏幕常亮控制（仅手机端）
   */
  initKeepScreenOnControl() {
    const settingItem = document.getElementById('keepScreenOnSetting');
    const toggle = document.getElementById('keepScreenOnToggle');
    if (!toggle || !settingItem) return;

    // 获取状态
    const status = this.wakeLockManager.getStatus();

    // 只在手机端显示设置项
    if (status.isMobile) {
      settingItem.hidden = false;

      // 恢复保存的设置
      const enabled = this.wakeLockManager.getUserEnabled();
      toggle.checked = enabled;

      // 监听变化
      toggle.addEventListener('change', () => {
        this.wakeLockManager.setUserEnabled(toggle.checked);
        this.updateWakeLockIcon();

        // 如果正在播放，立即应用
        if (toggle.checked && !this.player.audio.paused) {
          this.wakeLockManager.enable();
        } else if (!toggle.checked) {
          this.wakeLockManager.disable();
        }
      });
    } else {
      // PC端隐藏设置项
      settingItem.hidden = true;
    }
  }

  /**
   * 更新屏幕常亮图标
   */
  updateWakeLockIcon() {
    const icon = document.getElementById('wakeLockIcon');
    if (!icon) return;

    const status = this.wakeLockManager.getStatus();

    // PC端永不显示图标
    if (!status.isMobile) {
      icon.hidden = true;
      return;
    }

    // 手机端:只要正在播放就显示图标(不管用户是否启用功能)
    if (status.isEnabled) {
      icon.hidden = false;
    } else {
      icon.hidden = true;
    }
  }

  /**
   * 恢复默认设置
   */
  initResetButton() {
    const resetBtn = document.getElementById('resetSettingsBtn');
    if (!resetBtn) return;

    resetBtn.addEventListener('click', () => {
      // 默认值
      const defaults = {
        audioPlaybackRate: 1.0,
        playMode: 'continuous',
        autoScroll: true,
      };

      // 恢复播放速度
      this.player.setPlaybackRate(defaults.audioPlaybackRate);
      Storage.set('audioPlaybackRate', defaults.audioPlaybackRate);
      document.querySelectorAll('[data-speed]').forEach((btn) => {
        btn.classList.toggle('active', parseFloat(btn.dataset.speed) === defaults.audioPlaybackRate);
      });

      // 恢复播放模式
      const defaultSettings = this.playModeMapping[defaults.playMode];
      this.player.setReadMode(defaultSettings.readMode);
      this.player.setLoopMode(defaultSettings.loopMode);
      Storage.set('autoNext', defaultSettings.autoNext);
      Storage.set('playMode', defaults.playMode);

      // 更新 UI
      document.querySelectorAll('input[name="playMode"]').forEach((option) => {
        option.checked = option.value === defaults.playMode;
      });

      // 恢复自动跟随
      Storage.set('autoScroll', defaults.autoScroll);
      const autoScrollToggle = document.getElementById('autoScrollToggle');
      if (autoScrollToggle) autoScrollToggle.checked = defaults.autoScroll;

      // 显示提示
      Toast.success('已恢复默认设置', 2000);
    });
  }

  /**
   * 重置播放器按钮
   */
  initResetPlayerButton() {
    const resetPlayerBtn = document.getElementById('resetPlayerBtn');
    if (!resetPlayerBtn) return;

    resetPlayerBtn.addEventListener('click', () => {
      // 确认对话框
      if (!confirm('重置播放器将：\n\n✓ 停止当前播放\n✓ 清除播放状态\n✓ 清除所有定时器\n\n不会影响学习进度和设置。\n\n是否继续？')) {
        return;
      }

      // 调用播放器的重置方法
      this.player.resetPlayer();

      // 显示提示
      Toast.success('播放器已重置', 2000);
    });
  }

  /**
   * 打开设置面板
   */
  open() {
    this.overlay.hidden = false;
    this.panel.hidden = false;

    requestAnimationFrame(() => {
      this.overlay.classList.add('show');
      this.panel.classList.add('show');
    });

    document.body.style.overflow = 'hidden';

    // 激活焦点陷阱
    this.focusTrapCleanup = FocusTrap.activate(this.panel);
  }

  /**
   * 关闭设置面板
   */
  close() {
    this.overlay.classList.remove('show');
    this.panel.classList.remove('show');

    setTimeout(() => {
      this.overlay.hidden = true;
      this.panel.hidden = true;
    }, 200);

    document.body.style.overflow = '';

    // 清理焦点陷阱
    if (this.focusTrapCleanup) {
      this.focusTrapCleanup();
      this.focusTrapCleanup = null;
    }
  }
}
