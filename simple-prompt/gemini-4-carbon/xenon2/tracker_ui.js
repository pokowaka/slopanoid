(function () {
  'use strict';

  const XENON = (window.XENON = window.XENON || {});

  function hex2(n) {
    return (n & 0xff).toString(16).toUpperCase().padStart(2, '0');
  }

  class TrackerUIController {
    constructor(game) {
      this.game = game;
      this.isOpen = false;
      this.renderedPatternId = -1;
      this.lastHighlightedRow = -1;
      this.peaks = new Float32Array(28);

      this.hudCanvas = null;
      this.hudCtx = null;
      this.modalCanvas = null;
      this.modalCtx = null;
      this.modalEl = null;
      this.rowsContainer = null;
      this.rowEls = [];
    }

    bindDOM() {
      this.hudCanvas = document.getElementById('hud-analyser-canvas');
      if (this.hudCanvas) {
        this.hudCtx = this.hudCanvas.getContext('2d');
      }
      this.modalCanvas = document.getElementById('tracker-scope-canvas');
      if (this.modalCanvas) {
        this.modalCtx = this.modalCanvas.getContext('2d');
      }
      this.modalEl = document.getElementById('tracker-modal');
      this.rowsContainer = document.getElementById('tracker-rows-scroll');

      const closeBtn = document.getElementById('tracker-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => this.close());

      const dubBtn = document.getElementById('tracker-dub-btn');
      if (dubBtn) {
        dubBtn.addEventListener('click', () => {
          XENON.audio.init();
          XENON.audio.setShopMode(!XENON.audio.shopMode);
          this.refreshControls();
        });
      }

      const unmuteAllBtn = document.getElementById('tracker-reset-ch-btn');
      if (unmuteAllBtn) {
        unmuteAllBtn.addEventListener('click', () => {
          XENON.audio.channels.forEach((c) => {
            c.muted = false;
            c.solo = false;
          });
          XENON.audio.updateChannelGains();
          this.renderChannelHeaders();
        });
      }

      this.renderPatternButtons();
      this.renderChannelHeaders();
      this.buildPatternRows(0);
    }

    open() {
      if (this.isOpen) return;
      XENON.audio.init();
      this.isOpen = true;
      if (this.modalEl) this.modalEl.classList.remove('hidden');
      this.renderPatternButtons();
      this.renderChannelHeaders();
      this.buildPatternRows(XENON.audio.displayPattern);
      this.refreshControls();
    }

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      if (this.modalEl) this.modalEl.classList.add('hidden');
    }

    toggle() {
      if (this.isOpen) this.close();
      else this.open();
    }

    renderPatternButtons() {
      const wrap = document.getElementById('tracker-pattern-btns');
      if (!wrap) return;
      wrap.innerHTML = '';
      XENON.audio.patterns.forEach((pat) => {
        const btn = document.createElement('button');
        btn.className = 'trk-pat-btn' + (XENON.audio.displayPattern === pat.id ? ' active' : '');
        btn.dataset.patId = pat.id;
        btn.textContent = pat.name;
        btn.addEventListener('click', () => {
          XENON.audio.init();
          if (pat.id === 6) {
            XENON.audio.setShopMode(true);
          } else {
            if (XENON.audio.shopMode) XENON.audio.setShopMode(false);
            XENON.audio.jumpToPattern(pat.id);
          }
          this.buildPatternRows(pat.id);
          this.refreshControls();
        });
        wrap.appendChild(btn);
      });
    }

    renderChannelHeaders() {
      const headRow = document.getElementById('tracker-ch-headers');
      if (!headRow) return;
      headRow.innerHTML = '<div class="trk-col-rowhdr">ROW</div>';

      XENON.audio.channels.forEach((ch) => {
        const audible = XENON.audio.isChannelAudible(ch.idx);
        const div = document.createElement('div');
        div.className = 'trk-ch-head' + (!audible ? ' is-muted' : '');
        div.innerHTML = `
          <div class="trk-ch-top">
            <span class="trk-ch-code" style="color:${ch.color}">${ch.code}</span>
            <div class="trk-ms-btns">
              <button class="ms-btn ${ch.muted ? 'm-on' : ''}" data-mute="${ch.idx}" title="Mute ${ch.name}">M</button>
              <button class="ms-btn ${ch.solo ? 's-on' : ''}" data-solo="${ch.idx}" title="Solo ${ch.name}">S</button>
            </div>
          </div>
          <div class="trk-ch-name">${ch.name}</div>
          <div class="trk-vu-track"><div class="trk-vu-fill" id="trk-vu-${ch.idx}" style="background:${ch.color}"></div></div>
        `;
        headRow.appendChild(div);
      });

      headRow.querySelectorAll('[data-mute]').forEach((b) => {
        b.addEventListener('click', () => {
          XENON.audio.init();
          XENON.audio.toggleChannelMute(Number(b.getAttribute('data-mute')));
          this.renderChannelHeaders();
        });
      });
      headRow.querySelectorAll('[data-solo]').forEach((b) => {
        b.addEventListener('click', () => {
          XENON.audio.init();
          XENON.audio.toggleChannelSolo(Number(b.getAttribute('data-solo')));
          this.renderChannelHeaders();
        });
      });
    }

    buildPatternRows(patId) {
      if (!this.rowsContainer) return;
      const pat = XENON.audio.patterns[patId] || XENON.audio.patterns[0];
      this.renderedPatternId = pat.id;
      this.lastHighlightedRow = -1;
      this.rowsContainer.innerHTML = '';
      this.rowEls = [];

      for (let r = 0; r < 64; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'trk-row' + ((r % 4 === 0) ? ' beat-row' : '');
        let html = `<div class="trk-cell-row">${hex2(r)}</div>`;
        for (let c = 0; c < 8; c++) {
          const cell = pat.rows[r][c];
          const hasNote = cell.midi !== null;
          const instStr = cell.inst > 0 ? hex2(cell.inst) : '..';
          const fxStr = cell.fx || '...';
          html += `
            <div class="trk-cell ${hasNote ? 'has-note' : ''}">
              <span class="c-note">${cell.note}</span>
              <span class="c-inst">${instStr}</span>
              <span class="c-fx">${fxStr}</span>
            </div>
          `;
        }
        rowDiv.innerHTML = html;
        this.rowsContainer.appendChild(rowDiv);
        this.rowEls.push(rowDiv);
      }
    }

    refreshControls() {
      const dubBtn = document.getElementById('tracker-dub-btn');
      if (dubBtn) {
        dubBtn.classList.toggle('active', XENON.audio.shopMode);
        dubBtn.textContent = XENON.audio.shopMode ? 'DUB LOWPASS: ON' : 'DUB LOWPASS: OFF';
      }
      document.querySelectorAll('.trk-pat-btn').forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.patId) === XENON.audio.displayPattern);
      });
    }

    drawAnalyserCanvas(ctx, w, h) {
      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, w, h);

      // Subtle CRT phosphor grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 14) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const freq = XENON.audio.freqData;
      const wave = XENON.audio.waveData;
      const numBars = 24;
      const barW = Math.floor((w - 8) / numBars);

      // 1. Copper-Gradient 24-Band Spectrum Analyzer Bars + Peak Caps
      for (let i = 0; i < numBars; i++) {
        const bin = Math.min(freq.length - 1, Math.floor(i * 2.1) + 1);
        const val = XENON.audio.started ? (freq[bin] / 255) : (0.08 + 0.05 * Math.sin(performance.now() * 0.004 + i));
        const bh = Math.max(2, Math.floor(val * (h - 16)));
        if (bh > this.peaks[i]) this.peaks[i] = bh;
        else this.peaks[i] = Math.max(2, this.peaks[i] - 0.9);

        const bx = 4 + i * barW;
        const by = h - 3 - bh;

        const grad = ctx.createLinearGradient(0, h, 0, 8);
        grad.addColorStop(0, '#0ea5e9');
        grad.addColorStop(0.55, '#a855f7');
        grad.addColorStop(1, '#fde047');
        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, barW - 2, bh);

        // Peak-hold cap
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(bx, h - 4 - Math.floor(this.peaks[i]), barW - 2, 2);
      }

      // 2. Live Phosphor Waveform Oscilloscope Trace overlaid across top!
      ctx.beginPath();
      ctx.strokeStyle = XENON.audio.shopMode ? '#4ade80' : '#38bdf8';
      ctx.lineWidth = 1.6;
      const len = wave.length;
      for (let i = 0; i < len; i++) {
        const x = (i / (len - 1)) * w;
        const norm = XENON.audio.started ? ((wave[i] - 128) / 128) : (Math.sin(i * 0.2 + performance.now() * 0.005) * 0.08);
        const y = h * 0.36 + norm * (h * 0.28);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    update() {
      XENON.audio.updateVisualSync();

      // Always update Cabinet HUD Spectrum & Oscilloscope + Pattern readout
      if (this.hudCtx && this.hudCanvas) {
        this.drawAnalyserCanvas(this.hudCtx, this.hudCanvas.width, this.hudCanvas.height);
      }

      const pat = XENON.audio.patterns[XENON.audio.displayPattern] || XENON.audio.patterns[0];
      const hudPatEl = document.getElementById('hud-pattern-name');
      const hudRowEl = document.getElementById('hud-pattern-pos');
      if (hudPatEl) hudPatEl.textContent = pat.name;
      if (hudRowEl) {
        hudRowEl.textContent = `PAT ${hex2(pat.id)} · ROW ${hex2(XENON.audio.displayRow)} · ${pat.bpm} BPM`;
      }

      if (!this.isOpen) return;

      // Update Tracker Jukebox Modal!
      if (this.modalCtx && this.modalCanvas) {
        this.drawAnalyserCanvas(this.modalCtx, this.modalCanvas.width, this.modalCanvas.height);
      }

      if (this.renderedPatternId !== XENON.audio.displayPattern) {
        this.buildPatternRows(XENON.audio.displayPattern);
        this.refreshControls();
      }

      const curRow = XENON.audio.displayRow;
      if (curRow !== this.lastHighlightedRow && this.rowEls.length === 64) {
        if (this.lastHighlightedRow >= 0 && this.rowEls[this.lastHighlightedRow]) {
          this.rowEls[this.lastHighlightedRow].classList.remove('active-row');
        }
        const activeEl = this.rowEls[curRow];
        if (activeEl) {
          activeEl.classList.add('active-row');
          const rowH = activeEl.offsetHeight || 20;
          const viewH = this.rowsContainer.clientHeight || 280;
          this.rowsContainer.scrollTop = Math.max(0, curRow * rowH - viewH * 0.45);
        }
        this.lastHighlightedRow = curRow;
      }

      // Live per-channel VU meters
      for (let i = 0; i < 8; i++) {
        const vuEl = document.getElementById('trk-vu-' + i);
        if (vuEl) {
          const pct = Math.round(Math.min(1, XENON.audio.channels[i].vu) * 100);
          vuEl.style.width = pct + '%';
        }
      }

      const modalStatus = document.getElementById('tracker-status-line');
      if (modalStatus) {
        modalStatus.textContent = `${pat.name}  |  ROW ${hex2(curRow)}/3F  |  EPOCH ${XENON.audio.epoch} KEY  |  ${pat.bpm} BPM`;
      }
    }
  }

  XENON.TrackerUIController = TrackerUIController;
})();
