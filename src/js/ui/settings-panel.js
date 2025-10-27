import { Storage } from '../utils/storage.js';
import { FocusTrap } from '../utils/focus-trap.js';
import { Toast } from '../utils/toast.js';

/**
 * 设置面板管理
 */
export class SettingsPanel {
  constructor(player) {
    this.player = player;
    this.panel = document.getElementById('settingsPanel');
    this.overlay = document.getElementById('settingsOverlay');
    this.focusTrapCleanup = null;

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

    // 恢复默认按钮
    this.initResetButton();
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
    // 播放模式映射表
    const playModeMapping = {
      'single': { readMode: 'single', loopMode: 'none', autoNext: false },
      'single-loop': { readMode: 'single', loopMode: 'single', autoNext: false },
      'continuous': { readMode: 'continuous', loopMode: 'none', autoNext: false },
      'continuous-loop': { readMode: 'continuous', loopMode: 'all', autoNext: false },
      'continuous-next': { readMode: 'continuous', loopMode: 'none', autoNext: true }
    };

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
    const initialSettings = playModeMapping[savedPlayMode];
    this.player.setReadMode(initialSettings.readMode);
    this.player.setLoopMode(initialSettings.loopMode);
    Storage.set('autoNext', initialSettings.autoNext);

    // 添加变更事件
    modeOptions.forEach((option) => {
      option.addEventListener('change', () => {
        if (option.checked) {
          const settings = playModeMapping[option.value];

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
      const playModeMapping = {
        'single': { readMode: 'single', loopMode: 'none', autoNext: false },
        'single-loop': { readMode: 'single', loopMode: 'single', autoNext: false },
        'continuous': { readMode: 'continuous', loopMode: 'none', autoNext: false },
        'continuous-loop': { readMode: 'continuous', loopMode: 'all', autoNext: false },
        'continuous-next': { readMode: 'continuous', loopMode: 'none', autoNext: true }
      };

      const defaultSettings = playModeMapping[defaults.playMode];
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
