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

    // 读模式控制（设置面板）
    this.initReadModeControlInPanel();

    // 循环模式控制
    this.initLoopModeControl();

    // 自动跟随控制
    this.initAutoScrollControl();

    // 自动续播控制
    this.initAutoNextControl();

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
   * 读模式控制（设置面板）
   */
  initReadModeControlInPanel() {
    const modeBtns = document.querySelectorAll('[data-read-mode]');
    const savedMode = Storage.get('readMode', 'continuous');

    // 设置初始模式
    this.player.setReadMode(savedMode);
    this.updateSettingsConstraints();

    // 设置初始激活状态（互斥选择）
    modeBtns.forEach((btn) => {
      const mode = btn.dataset.readMode;
      btn.classList.toggle('active', mode === savedMode);
    });

    // 添加点击事件
    modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const newMode = btn.dataset.readMode;
        this.player.setReadMode(newMode);
        Storage.set('readMode', newMode);

        // 更新按钮状态（互斥选择）
        modeBtns.forEach((b) => b.classList.toggle('active', b === btn));

        // 更新设置约束
        this.updateSettingsConstraints();
      });
    });
  }

  /**
   * 循环模式控制
   */
  initLoopModeControl() {
    const loopBtns = document.querySelectorAll('[data-loop-mode]');
    const savedLoop = Storage.get('loopMode', 'none');

    // 设置初始激活状态（互斥选择）
    loopBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.loopMode === savedLoop);
    });

    // 添加点击事件
    loopBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.loopMode;
        const readMode = this.player.readMode || 'continuous';

        // 检查设置冲突并提示
        if (btn.disabled) {
          if (mode === 'single' && readMode === 'continuous') {
            Toast.warning('单句循环仅在点读模式下可用', 2000);
          } else if (mode === 'all' && readMode === 'single') {
            Toast.warning('整篇循环仅在连读模式下可用', 2000);
          }
          return;
        }

        this.player.setLoopMode(mode);

        // 更新按钮状态（互斥选择）
        loopBtns.forEach((b) => b.classList.toggle('active', b === btn));
      });
    });
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
   * 自动续播控制
   */
  initAutoNextControl() {
    const toggle = document.getElementById('autoNextToggle');
    if (!toggle) return;

    const saved = Storage.get('autoNext', false);
    toggle.checked = saved;

    toggle.addEventListener('change', () => {
      const readMode = this.player.readMode || 'continuous';

      // 检查设置冲突并提示
      if (toggle.checked && readMode === 'single') {
        Toast.warning('自动续播仅在连读模式下可用', 2000);
        toggle.checked = false;
        return;
      }

      Storage.set('autoNext', toggle.checked);
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
        readMode: 'continuous',
        loopMode: 'none',
        autoScroll: true,
        autoNext: false,
      };

      // 恢复播放速度
      this.player.setPlaybackRate(defaults.audioPlaybackRate);
      Storage.set('audioPlaybackRate', defaults.audioPlaybackRate);
      document.querySelectorAll('[data-speed]').forEach((btn) => {
        btn.classList.toggle('active', parseFloat(btn.dataset.speed) === defaults.audioPlaybackRate);
      });

      // 恢复读模式
      this.player.setReadMode(defaults.readMode);
      Storage.set('readMode', defaults.readMode);
      document.querySelectorAll('[data-read-mode]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.readMode === defaults.readMode);
      });

      // 恢复循环模式
      this.player.setLoopMode(defaults.loopMode);
      Storage.set('loopMode', defaults.loopMode);
      document.querySelectorAll('[data-loop-mode]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.loopMode === defaults.loopMode);
      });

      // 恢复自动跟随
      Storage.set('autoScroll', defaults.autoScroll);
      const autoScrollToggle = document.getElementById('autoScrollToggle');
      if (autoScrollToggle) autoScrollToggle.checked = defaults.autoScroll;

      // 恢复自动续播
      Storage.set('autoNext', defaults.autoNext);
      const autoNextToggle = document.getElementById('autoNextToggle');
      if (autoNextToggle) autoNextToggle.checked = defaults.autoNext;

      // 更新设置约束
      this.updateSettingsConstraints();

      // 显示提示
      Toast.success('已恢复默认设置', 2000);
    });
  }

  /**
   * 更新设置项约束
   * 根据当前读模式，启用/禁用相关选项
   */
  updateSettingsConstraints() {
    const readMode = this.player.readMode || 'continuous';
    const currentLoop = this.player.loopMode || 'none';
    const loopBtns = document.querySelectorAll('[data-loop-mode]');
    const autoNextToggle = document.getElementById('autoNextToggle');

    if (readMode === 'single') {
      // 点读模式：禁用整篇循环和自动续播

      // 如果当前是整篇循环，自动降级到不循环
      if (currentLoop === 'all') {
        this.player.setLoopMode('none');
        Storage.set('loopMode', 'none');

        // 更新 UI 状态
        loopBtns.forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.loopMode === 'none');
        });
      }

      // 设置按钮禁用状态
      loopBtns.forEach((btn) => {
        btn.disabled = btn.dataset.loopMode === 'all';
      });

      if (autoNextToggle) {
        autoNextToggle.disabled = true;
      }
    } else {
      // 连读模式：禁用单句循环

      // 如果当前是单句循环，自动降级到不循环
      if (currentLoop === 'single') {
        this.player.setLoopMode('none');
        Storage.set('loopMode', 'none');

        // 更新 UI 状态
        loopBtns.forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.loopMode === 'none');
        });
      }

      // 设置按钮禁用状态
      loopBtns.forEach((btn) => {
        btn.disabled = btn.dataset.loopMode === 'single';
      });

      if (autoNextToggle) {
        autoNextToggle.disabled = false;
      }
    }
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
