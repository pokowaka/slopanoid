/* ============================================================================
 * js/input.js
 * Unified Keyboard + Mouse Arcade Input Controller (60 Hz Edge-Buffered)
 * ============================================================================ */
(function () {
  'use strict';

  const GNG = (window.GNG = window.GNG || {});

  const KEY_BINDINGS = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    Space: 'jump',
    KeyZ: 'jump',
    KeyK: 'jump',
    KeyJ: 'attack',
    KeyX: 'attack',
    KeyE: 'special',
    KeyC: 'special',
    KeyP: 'pause',
    Escape: 'pause',
    Tab: 'map',
    KeyT: 'crt',
    KeyM: 'mute',
    KeyR: 'retry',
    Enter: 'confirm',
    Digit1: 'warp1',
    Digit2: 'warp2',
    Digit3: 'warp3',
    Digit4: 'warp4',
    Digit5: 'warp5',
    Digit6: 'warp6'
  };

  class InputManager {
    constructor(canvas, onFirstGesture) {
      this.canvas = canvas;
      this.onFirstGesture = onFirstGesture || null;
      this.gestureFired = false;

      this.down = Object.create(null);
      this.pressed = Object.create(null);
      this.released = Object.create(null);
      this.keyCounts = Object.create(null);

      this.mouseX = 160;
      this.mouseY = 100;
      this.mouseClicked = false;
      this.jumpBuffer = 0;

      this._bindEvents();
    }

    _notifyGesture() {
      if (!this.gestureFired && this.onFirstGesture) {
        this.gestureFired = true;
        this.onFirstGesture();
      } else if (this.onFirstGesture) {
        this.onFirstGesture();
      }
    }

    _setAction(action, isDown) {
      const prev = !!this.down[action];
      if (isDown) {
        this.keyCounts[action] = (this.keyCounts[action] || 0) + 1;
        this.down[action] = true;
        if (!prev) {
          this.pressed[action] = true;
          if (action === 'jump') {
            this.jumpBuffer = 6;
          }
        }
      } else {
        this.keyCounts[action] = Math.max(0, (this.keyCounts[action] || 1) - 1);
        if (this.keyCounts[action] === 0) {
          this.down[action] = false;
          if (prev) {
            this.released[action] = true;
          }
        }
      }
    }

    _updateMousePos(e) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.mouseX = (((e.clientX - rect.left) / rect.width) * GNG.WIDTH) | 0;
        this.mouseY = (((e.clientY - rect.top) / rect.height) * GNG.HEIGHT) | 0;
      }
    }

    _bindEvents() {
      window.addEventListener('keydown', (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const action = KEY_BINDINGS[e.code];
        if (action) {
          e.preventDefault();
          this._notifyGesture();
          if (!e.repeat) {
            this._setAction(action, true);
          }
        }
      });

      window.addEventListener('keyup', (e) => {
        const action = KEY_BINDINGS[e.code];
        if (action) {
          e.preventDefault();
          this._setAction(action, false);
        }
      });

      window.addEventListener('blur', () => {
        for (const k of Object.keys(this.down)) {
          this.down[k] = false;
          this.keyCounts[k] = 0;
        }
      });

      this.canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });

      this.canvas.addEventListener('mousemove', (e) => {
        this._updateMousePos(e);
      });

      this.canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this._notifyGesture();
        this._updateMousePos(e);
        if (e.button === 0) {
          this.mouseClicked = true;
          this._setAction('attack', true);
        } else if (e.button === 2) {
          this._setAction('special', true);
        }
      });

      window.addEventListener('mouseup', (e) => {
        if (e.button === 0 && this.down.attack) {
          this._setAction('attack', false);
        } else if (e.button === 2 && this.down.special) {
          this._setAction('special', false);
        }
      });
    }

    consumeJumpBuffer() {
      if (this.jumpBuffer > 0) {
        this.jumpBuffer = 0;
        return true;
      }
      return false;
    }

    endFrame() {
      for (const k of Object.keys(this.pressed)) {
        this.pressed[k] = false;
      }
      for (const k of Object.keys(this.released)) {
        this.released[k] = false;
      }
      this.mouseClicked = false;
      if (this.jumpBuffer > 0) {
        this.jumpBuffer--;
      }
    }
  }

  GNG.InputManager = InputManager;
})();
