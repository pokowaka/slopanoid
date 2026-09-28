'use strict';
/* =============================================================================
 *  XENON II · MEGABLAST — ui.js
 *  Everything outside the 320x200 framebuffer: cabinet HUD, LED spectrum
 *  analyser + phosphor oscilloscope, screen scaling / CRT bezel, Crispin's
 *  Intergalactic Upgrade Store (animated portrait, paper-doll hardpoints,
 *  buy / upgrade / 50% trade-in) and the live 8-channel tracker jukebox.
 * ===========================================================================*/
const UI = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const hex2 = v => (v | 0).toString(16).toUpperCase().padStart(2, '0');
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let el = {};
  let uiFrame = 0;
  const cache = {};
  function setText(node, key, v) { if (cache[key] !== v) { cache[key] = v; node.textContent = v; } }
  function setHTML(node, key, v) { if (cache[key] !== v) { cache[key] = v; node.innerHTML = v; } }

  // ============================================================ SCREEN FIT
  function fit() {
    const main = $('main'), help = $('help'), bez = $('bezel');
    const pad = bez.classList.contains('crt-off') ? 8 : 36;
    const availW = main.clientWidth - 282 - pad;
    const availH = main.clientHeight - help.offsetHeight - 6 - pad;
    let s = Math.min(availW / 320, availH / 200);
    s = s >= 3 ? Math.floor(s) : Math.max(1, Math.floor(s * 2) / 2);
    const cv = el.screen;
    cv.style.width = 320 * s + 'px'; cv.style.height = 200 * s + 'px';
    help.style.maxWidth = Math.max(320 * s, 400) + 'px';
    document.documentElement.style.setProperty('--scan', s + 'px');
  }
  function toggleCRT() {
    const b = $('bezel'), on = b.classList.contains('crt-on');
    b.classList.toggle('crt-on', !on); b.classList.toggle('crt-off', on);
    el.btnCrt.textContent = on ? 'CRT BEZEL OFF [C]' : 'CRT BEZEL [C]';
    fit();
  }
  function toggleSound() {
    Music.init();
    const on = Music.toggleSound();
    el.btnMute.textContent = on ? 'SOUND ON [M]' : 'SOUND OFF [M]';
  }
  function warp(i) {
    Music.init();
    if (Game.modal === 'shop') return;
    if (Game.modal === 'tracker') closeTracker();
    const s = Game.state;
    if (s === 'title' || s === 'gameover' || s === 'victory' || s === 'boot') Game.startGame(i);
    else { Game.loadStage(i); onStageStart(); }
  }

  // ============================================================ SIDE HUD
  function updateHUD(force) {
    const P = Game.P, st = Game.state, w = Game.world;
    if (st === 'title' || !w) {
      setText(el.hudStage, 'stage', 'INSERT COIN');
      setText(el.hudEpoch, 'epoch', 'PRESS ENTER · 1-5 WARP');
    } else {
      setText(el.hudStage, 'stage', 'STAGE ' + (Game.stageIdx + 1) + ' · ' + w.def.name);
      setText(el.hudEpoch, 'epoch', w.def.epoch + (Game.boss ? ' · BOSS: ' + w.def.bossName : ''));
    }
    setText(el.hudScore, 'score', String(P.score).padStart(7, '0'));
    setText(el.hudCredits, 'cred', String(P.credits));
    const sh = Math.max(0, Math.min(100, P.shield / Game.maxShield() * 100)).toFixed(1) + '%';
    if (cache.sh !== sh) { cache.sh = sh; el.hudShield.style.width = sh; }
    const ch = Math.max(0, Math.min(100, P.chrono / 180 * 100)).toFixed(1) + '%';
    if (cache.ch !== ch) { cache.ch = ch; el.hudChrono.style.width = ch; }
    setText(el.hudLives, 'lives', String(Math.max(0, P.lives)));
    setText(el.hudBombs, 'bombs', String(P.bombs));
    setText(el.hudSpeed, 'speed', String(P.speedLvl));
    setText(el.hudNash, 'nash', P.nashT > 0 ? Math.ceil(P.nashT / 60) + 'S!' : String(P.nashwan));
    if (!force && uiFrame % 12) return;
    let hp = '';
    for (const s of Game.SLOTS) {
      const q = Game.equip[s];
      hp += q ? `<li><span>${esc(Game.SLOT_NAMES[s])}</span><span>${esc(Game.ITEMS[q.id].name)} L${q.lvl}</span></li>`
        : `<li class="empty"><span>${esc(Game.SLOT_NAMES[s])}</span><span>- EMPTY -</span></li>`;
    }
    setHTML(el.hudHard, 'hard', hp);
    const syn = Game.synergy();
    setHTML(el.hudSyn, 'syn', Game.SYNERGIES.map(s => `<li class="${syn[s.id] ? 'on' : ''}">${esc(s.name)}<br><small>${esc(s.need)}</small></li>`).join(''));
  }

  // ============================================================ ANALYSER
  let fbuf = null, tbuf = null;
  const peaks = new Float32Array(24);
  function drawAnalyser() {
    const sc = el.specCtx, cw = el.spec.width, chh = el.spec.height;
    sc.fillStyle = '#020306'; sc.fillRect(0, 0, cw, chh);
    const an = Music.analyser;
    const N = 24, bw = cw / N, SEG = 3, SEGS = Math.floor((chh - 4) / SEG);
    if (an) {
      if (!fbuf || fbuf.length !== an.frequencyBinCount) { fbuf = new Uint8Array(an.frequencyBinCount); tbuf = new Uint8Array(an.fftSize); }
      an.getByteFrequencyData(fbuf);
    }
    for (let i = 0; i < N; i++) {
      let v = 0;
      if (an) {
        const lo = Math.floor(2 * Math.pow(fbuf.length / 2, i / N)), hi = Math.max(lo + 1, Math.floor(2 * Math.pow(fbuf.length / 2, (i + 1) / N)));
        for (let k = lo; k < hi && k < fbuf.length; k++) v = Math.max(v, fbuf[k]);
        v /= 255;
      }
      const n = Math.round(v * SEGS);
      peaks[i] = Math.max(peaks[i] - 0.012, v);
      for (let s = 0; s < SEGS; s++) {
        const u = s / SEGS, lit = s < n;
        sc.fillStyle = lit ? (u > 0.8 ? '#ff4a3a' : u > 0.55 ? '#ffe040' : '#3cff5a') : (u > 0.8 ? '#2a0c0c' : u > 0.55 ? '#2a260c' : '#0c2a12');
        sc.fillRect(i * bw + 1, chh - 2 - (s + 1) * SEG, bw - 2, SEG - 1);
      }
      const py = chh - 2 - Math.round(peaks[i] * SEGS) * SEG - SEG;
      sc.fillStyle = '#ffffff'; sc.fillRect(i * bw + 1, Math.max(0, py), bw - 2, 1);
    }
    // phosphor oscilloscope with persistence
    const oc = el.scopeCtx, ow = el.scope.width, oh = el.scope.height;
    oc.fillStyle = 'rgba(2,6,4,0.45)'; oc.fillRect(0, 0, ow, oh);
    oc.strokeStyle = 'rgba(60,255,120,0.12)'; oc.lineWidth = 1; oc.beginPath();
    for (let x = 0; x <= ow; x += ow / 8) { oc.moveTo(x + 0.5, 0); oc.lineTo(x + 0.5, oh); }
    for (let y = 0; y <= oh; y += oh / 4) { oc.moveTo(0, y + 0.5); oc.lineTo(ow, y + 0.5); }
    oc.stroke();
    oc.strokeStyle = '#7dff8a'; oc.shadowColor = '#3cff5a'; oc.shadowBlur = 6; oc.lineWidth = 1.4; oc.beginPath();
    if (an) {
      an.getByteTimeDomainData(tbuf);
      let start = 0; for (let k = 1; k < tbuf.length / 2; k++) if (tbuf[k - 1] < 128 && tbuf[k] >= 128) { start = k; break; } // trigger
      const span = Math.min(tbuf.length - start, 512);
      for (let x = 0; x < ow; x++) { const v = tbuf[start + Math.floor(x / ow * span)] / 128 - 1, y = oh / 2 - v * oh * 0.46; x ? oc.lineTo(x, y) : oc.moveTo(x, y); }
    } else { oc.moveTo(0, oh / 2); oc.lineTo(ow, oh / 2); }
    oc.stroke(); oc.shadowBlur = 0;
    if (!an) { oc.fillStyle = '#3cff5a'; oc.font = '9px monospace'; oc.fillText('NO SIGNAL · PRESS A KEY', 6, 12); }
  }
  function updateNowPlaying() {
    if (!Music.ready) { setText(el.nowPlaying, 'np', '♪ AUDIO ASLEEP — PRESS ANY KEY / CLICK'); return; }
    const st = Music.state(), song = Music.song;
    setText(el.nowPlaying, 'np', `♪ ${song.era.name} · ${hex2(st.pat)} ${Music.PAT_NAMES[st.pat]} · ROW ${hex2(st.row)} · ${Music.mode.toUpperCase()}`);
  }

  // ============================================================ CRISPIN
  const LINES = {
    mid: ['Mid-epoch pit stop! Credits on the counter, hands off the merchandise.', 'Oi! You look like you could use some firepower. And a bath.', 'Welcome back, sunshine. Evolution is a buyer\'s market today.'],
    end: ['Nice flying out there. That boss is now a very expensive fossil.', 'Another epoch saved! Lovely. Now let\'s talk about my commission.', 'Look at you, still in one piece. Mostly. Shopping time!'],
    dock: ['Docking outside business hours? That\'s a surcharge... joking. Mostly.', 'Emergency pit stop, eh? Don\'t drip plasma on the carpet.', 'Back already? I\'ve only just polished the chrome.'],
    buy: ['Lovely choice. No refunds, no warranties, no crying.', 'That\'ll bolt on nicely. Mind the paint.', 'Sold! My accountant thanks you. So does my hair.', 'Ooh, shiny. It\'s like Christmas but with more explosions.'],
    trade: ['Old one\'s in the skip. Knocked 50% off for you, because I\'m generous.', 'Trade-in accepted! Your old kit will make a lovely ashtray.'],
    upgrade: ['Level %L! Now it\'s illegal in fourteen star systems.', 'Tuned, tweaked and overclocked. Level %L. Don\'t tell the Xenites.', 'Level %L. I added go-faster stripes. Free of charge. This once.'],
    sell: ['%V credits. Half price, take it or leave it. Big hair costs money.', 'I\'ll give you %V for it. Robbery? No, that\'s called retail.'],
    poor: ['Credits, my friend. That\'s the thing you don\'t have.', 'Do I look like a charity? Don\'t answer that.', 'Come back when your wallet has evolved past the Cambrian.'],
    max: ['It\'s maxed. Any more power and it\'ll achieve sentience.', 'Level 3 is the limit. After that it starts demanding wages.'],
    full: ['Your shield\'s already at 100%. I can polish it though. 50 credits.', 'Already maxed. I admire the enthusiasm, not the maths.'],
    repair: ['Patched up good as new. Well, good as second-hand.', 'Welded, riveted and sprayed with chrome. Shields at full!'],
    speed: ['Speed booster fitted. Try not to leave your stomach behind.', 'Faster! Faster! That\'s what the kids want.'],
    bomb: ['One smart bomb. Point it AWAY from my shop, please.', 'MEGABLAST in a can. Shake well before use.'],
    nashwan: ['SUPER NASHWAN POWER! Press X and everything turns gold. Including you.', 'The legendary Nashwan! Twenty seconds of pure unfiltered 1989.'],
    idle: ['Take your time. I charge by the minute. Not really. Or do I?', 'This track? Electro-dub. I made it myself. On a toaster.', 'Remember: sell high, buy chrome.', 'Psst. Side-lasers and Bounce-Orbs? Beautiful synergy, that.', 'Arc beam plus drones. Tesla would weep. Probably with joy.', 'Proximity mines love a bit of reverse thrust. Trust me.'],
  };
  let crispin = null, dollSurf = null, dlg = { full: '', n: 0, t: 0 }, jaw = 0, idleT = 0;
  function say(text) { dlg = { full: text, n: 0, t: 0 }; idleT = 0; }
  function sayK(k, rep) { let s = pick(LINES[k]); if (rep) for (const r in rep) s = s.replace(r, rep[r]); say(s); }
  function intelTarget() {
    const i = Game.shopReason === 'end' ? Game.stageIdx + 1 : Game.stageIdx;
    return i < Game.BOSSES.length ? i : -1;
  }
  function drawCrispin() {
    const G = GFX, S = crispin.surf, C = G.C, R = G.R, cr = SPR.crispin, f = uiFrame;
    if (!cr) return;
    G.target(S);
    const beat = Music.beat(), st = Music.state();
    const lv = Music.level;
    // neon backdrop: magenta dusk gradient + sweeping venetian light
    for (let y = 0; y < 112; y++) {
      const b = y / 112 * 4.2;
      for (let x = 0; x < 112; x++) {
        const l = 1 + Math.floor(b + (((x + y) & 1) ? 0.5 : 0));
        S.px[y * 112 + x] = R.MAG + Math.min(5, l);
      }
    }
    for (let k = 0; k < 6; k++) { const y = ((k * 19 + f * 0.4) % 114) | 0; G.hline(0, 111, y, R.PLASMA + 4); }
    for (let k = 0; k < 2; k++) { const x = 56 + Math.sin(f * 0.02 + k * 3) * 60; G.line(x, 0, 56 + (x - 56) * 0.3, 111, R.MAG + 9); }
    // LED columns pumping with the music
    for (let c = 0; c < 4; c++) {
      const hL = Math.round((lv[c * 2] || 0) * 40), hR = Math.round((lv[c * 2 + 1] || 0) * 40);
      for (let s = 0; s < hL; s += 3) G.rect(1 + c * 2, 104 - s, 1, 2, s > 30 ? C.RED : s > 20 ? C.YELLOW : C.GREEN);
      for (let s = 0; s < hR; s += 3) G.rect(110 - c * 2, 104 - s, 1, 2, s > 30 ? C.RED : s > 20 ? C.YELLOW : C.GREEN);
    }
    G.textC("CRISPIN'S", 56, 1, (f >> 4) % 7 ? R.MAG + 15 : R.MAG + 6, R.MAG + 3);
    // body (static) then the head, which bobs to the beat and sways every other beat
    G.blit(cr.body, 0, 78);
    const bob = beat < 0.35 ? Math.round(2.4 * (1 - beat / 0.35)) : 0;
    const sway = ((st.row >> 2) & 1) ? 1 : -1;
    const hx = sway * (Music.ready ? 1 : 0), hy = 8 + bob;
    G.blit(cr.head, hx, hy);
    // mouth + jaw (typewriter-synced)
    const mouthY = hy + 66, open = Math.round(jaw);
    if (open > 0) { G.circle(56 + hx, mouthY + open / 2, Math.max(1, open * 0.7), C.OUTLINE); G.rect(51 + hx, mouthY, 11, open + 1, C.OUTLINE); G.hline(52 + hx, 60 + hx, mouthY, C.WHITE); }
    G.blitC(cr.jaw, 56 + hx, mouthY + 13 + open);
    // shades with a moving specular sheen band
    const gx = 16 + hx, gy = hy + 30;
    G.blit(cr.glasses, gx, gy);
    const ph = (f * 1.4) % 110;
    for (let ly = -5; ly <= 5; ly++) for (const lc of [22, 58]) for (let lx = -12; lx <= 12; lx++) {
      const X = gx + lc + lx, Y = gy + 11 + ly;
      if (!cr.glasses.d[(11 + ly) * 80 + lc + lx]) continue;
      const s = (lc + lx + ly * 0.9 - ph + 220) % 110;
      if (s < 3) G.pset(X, Y, R.CHROME + 15); else if (s < 6) G.pset(X, Y, R.CHROME + 11); else if (s > 104 && ((X + Y) & 1)) G.pset(X, Y, R.MAG + 9);
    }
    // headphones: chrome band + cups whose drivers glow with the kick
    G.blit(cr.band, hx, bob + 2);
    const k = Math.min(1, lv[5] || 0);
    for (const cx of [14, 98]) { G.blitC(cr.cup, cx + hx, 46 + bob); if (k > 0.05) G.glow(cx + hx, 46 + bob, 3 + k * 5, R.MAG, 0.6 + k); }
    G.target();
    G.presentSurface(S, crispin.ctx, crispin.img);
  }
  function tickDialogue() {
    if (dlg.n < dlg.full.length) {
      if (++dlg.t % 2 === 0) {
        dlg.n++;
        const ch = dlg.full[dlg.n - 1];
        if (/[A-Za-z0-9]/.test(ch)) { if (dlg.n % 2 === 0) jaw = 2 + Math.random() * 3; if (dlg.n % 3 === 0) Music.sfx('talk', Math.random() * 4); }
        else jaw = 0;
        el.crispinSays.textContent = dlg.full.slice(0, dlg.n);
      }
    } else if (++idleT > 60 * 14) sayK('idle');
    jaw = Math.max(0, jaw - 0.35);
  }

  // ============================================================ SHOP
  let selSlot = 'nose';
  function openShop(reason) {
    el.shop.classList.remove('hidden');
    selSlot = 'nose'; cache.shopSyn = Game.synergy();
    let s = pick(LINES[reason] || LINES.dock);
    const it = intelTarget();
    if (reason !== 'dock' && it >= 0 && !Game.P.intel) s += ' Word on the wire: next up is ' + Stages.DEFS[it].bossName + '. Intel\'s on the menu.';
    say(s);
    el.crispinSays.textContent = '';
    renderShop();
  }
  function closeShop() { el.shop.classList.add('hidden'); }
  function renderShop() {
    const P = Game.P, eq = Game.equip;
    el.shopCredits.textContent = P.credits;
    for (const b of el.slots) {
      const s = b.dataset.slot, q = eq[s];
      b.classList.toggle('sel', s === selSlot); b.classList.toggle('filled', !!q);
      b.querySelector('small').textContent = q ? Game.ITEMS[q.id].name + ' L' + q.lvl : '- EMPTY -';
    }
    el.shopSlotTitle.textContent = Game.SLOT_NAMES[selSlot] + ' HARDPOINT';
    let h = '';
    for (const id in Game.ITEMS) {
      if (!Game.slotAccepts(selSlot, id)) continue;
      const it = Game.ITEMS[id], q = Game.quote(selSlot, id), cur = eq[selSlot], mine = cur && cur.id === id;
      const afford = P.credits >= q.cost;
      let pr, acts;
      if (mine) {
        pr = `EQUIPPED · L${cur.lvl}/3`;
        acts = q.kind === 'max' ? '<button disabled>MAXED</button>' : `<button data-act="buy" data-id="${id}" ${afford ? '' : 'disabled'}>UPGRADE L${cur.lvl + 1} · ${q.cost}</button>`;
        acts += `<button class="sell" data-act="sell">SELL · +${Math.floor(cur.paid * 0.5)}</button>`;
      } else {
        pr = it.price + ' CR';
        acts = q.kind === 'trade'
          ? `<button data-act="buy" data-id="${id}" ${afford ? '' : 'disabled'}>TRADE-IN · ${q.cost} (−${q.trade})</button>`
          : `<button data-act="buy" data-id="${id}" ${afford ? '' : 'disabled'}>BUY · ${q.cost}</button>`;
      }
      h += `<div class="item${mine ? ' equipped' : ''}"><span class="nm">${esc(it.name)}</span><span class="pr">${esc(pr)}</span><span class="ds">${esc(it.desc)}</span><span class="acts">${acts}</span></div>`;
    }
    el.shopItems.innerHTML = h;
    let sp = '';
    for (const k in Game.SUPPLIES) {
      const s = Game.SUPPLIES[k], ss = Game.supplyState(k);
      let desc = s.desc;
      if (k === 'intel') { const t = intelTarget(); desc = t >= 0 ? 'Target: ' + Stages.DEFS[t].bossName + '. Marks its weak point (x4 damage).' : 'Nothing left to scout.'; }
      if (k === 'repair') desc += ` (${Math.round(P.shield)}/${Game.maxShield()})`;
      if (k === 'speed') desc += ` [LVL ${P.speedLvl}/3]`;
      if (k === 'bomb') desc += ` [${P.bombs}/5]`;
      sp += `<div class="item${k === 'nashwan' ? ' golden' : ''}"><span class="nm">${esc(s.name)}</span><span class="pr">${ss.price} CR</span><span class="ds">${esc(desc)}</span>` +
        `<span class="acts"><button data-sup="${k}" ${ss.ok ? '' : 'disabled'}>${ss.why || 'BUY'}</button></span></div>`;
    }
    el.shopSupplies.innerHTML = sp;
    const syn = Game.synergy();
    el.shopSyn.innerHTML = Game.SYNERGIES.map(s => `<div class="${syn[s.id] ? 'on' : ''}">${syn[s.id] ? '★ ' : '☆ '}${esc(s.name)} — ${esc(s.need)}</div>`).join('');
  }
  function onShopClick(e) {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.act === 'buy') {
      const r = Game.shopBuy(selSlot, b.dataset.id);
      if (r === 'upgrade') sayK('upgrade', { '%L': Game.equip[selSlot].lvl });
      else if (r === 'poor' || r === 'max') sayK(r);
      else sayK(r === 'trade' ? 'trade' : 'buy');
      if (Game.synergy().prism || Game.synergy().tesla || Game.synergy().nova) {
        const syn = Game.synergy(), was = cache.shopSyn || {};
        for (const s of Game.SYNERGIES) if (syn[s.id] && !was[s.id]) { say('Ooh! ' + s.name + ' online! That combo is gorgeous. Like my hair.'); Music.sfx('powerup'); }
      }
    } else if (b.dataset.act === 'sell') {
      const v = Game.shopSell(selSlot);
      if (v != null) sayK('sell', { '%V': v });
    } else if (b.dataset.sup) {
      const k = b.dataset.sup, r = Game.buySupply(k);
      if (r === 'ok') { if (k === 'intel') { const t = intelTarget(); say(t >= 0 ? Game.BOSSES[t].intel : 'Pleasure doing business.'); } else sayK(k); }
      else if (r === 'FULL') sayK('full'); else if (r === 'poor') sayK('poor'); else sayK('max');
    }
    cache.shopSyn = Game.synergy();
    renderShop();
  }
  function selectSlot(s) { selSlot = s; Music.sfx('ping'); renderShop(); }

  // ============================================================ TRACKER
  let trkOpen = false, trkBuiltKey = '', trkRows = [], trkCurRow = null, trkChEls = [];
  const NOTE = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
  function fmtCell(c) {
    if (!c) return '<span class="e">--- .. ...</span>';
    const n = c.n == null ? '<span class="e">---</span>' : `<span class="n">${NOTE[c.n % 12]}${Math.floor(c.n / 12) - 1}</span>`;
    const i = c.i ? `<span class="i">${hex2(c.i)}</span>` : '<span class="e">..</span>';
    let f;
    if (c.fx) f = `<span class="f">${c.fx}${hex2(c.fxv)}</span>`;
    else if (c.v !== 64 && c.n != null) f = `<span class="f">C${hex2(c.v)}</span>`;
    else f = '<span class="e">...</span>';
    return `${n} ${i} ${f}`;
  }
  function buildTrackerStatic() {
    el.trkOrders.innerHTML = Music.PAT_NAMES.map((n, p) => `<button data-pat="${p}" title="${esc(n)}">${hex2(p)} ${esc(n.split(' ')[0])}</button>`).join('');
    el.trkSongs.innerHTML = Music.ERAS.map((e, i) => `<button data-era="${i}">${i + 1}. ${esc(e.name)}</button>`).join('');
    el.trkModes.innerHTML = ['normal', 'boss', 'shop'].map(m => `<button data-mode="${m}">${m.toUpperCase()}</button>`).join('');
    el.trkChans.innerHTML = '<div></div>' + Music.CH_NAMES.map((n, c) =>
      `<div class="trk-ch" data-ch="${c}"><span class="nm">${c + 1}·${esc(n)}</span><span class="vu"><i></i></span><span class="b"><button class="m" data-m="${c}">M</button><button class="s" data-s="${c}">S</button></span></div>`).join('');
    trkChEls = [...el.trkChans.querySelectorAll('.trk-ch')].map(d => ({ d, vu: d.querySelector('.vu i'), m: d.querySelector('.m'), s: d.querySelector('.s') }));
    trkBuiltKey = '';
  }
  function buildGrid(song, p) {
    const pat = song.pats[p];
    let h = '';
    for (let r = 0; r < Music.ROWS; r++) {
      h += `<div class="trk-row${r % 16 === 0 ? ' bar' : r % 4 === 0 ? ' beat' : ''}"><span class="rn">${hex2(r)}</span>`;
      for (let c = 0; c < Music.NCH; c++) h += `<span class="c">${fmtCell(pat.ch[c][r])}</span>`;
      h += '</div>';
    }
    el.trkGrid.innerHTML = h;
    trkRows = [...el.trkGrid.children]; trkCurRow = null;
  }
  function openTracker() {
    if (Game.modal === 'shop') return;
    Music.init();
    trkOpen = true; Game.modal = 'tracker';
    el.tracker.classList.remove('hidden');
    buildTrackerStatic();
  }
  function closeTracker() {
    if (!trkOpen) return;
    trkOpen = false; el.tracker.classList.add('hidden');
    if (Game.modal === 'tracker') Game.modal = null;
    // hand the soundtrack back to the game
    if (Game.world && Game.state !== 'title') { Music.setEra(Game.stageIdx); Music.setMode(Game.boss ? 'boss' : 'normal'); }
  }
  function toggleTracker() { trkOpen ? closeTracker() : openTracker(); }
  function updateTracker() {
    const song = Music.song; if (!song) return;
    const st = Music.state();
    const key = song.eraIdx + ':' + st.pat;
    if (key !== trkBuiltKey) { trkBuiltKey = key; buildGrid(song, st.pat); }
    el.trkGrid.style.transform = `translateY(${(11 - st.row) * 14}px)`;
    const rowEl = trkRows[st.row];
    if (rowEl !== trkCurRow) { if (trkCurRow) trkCurRow.classList.remove('cur'); if (rowEl) rowEl.classList.add('cur'); trkCurRow = rowEl; }
    setText(el.trkSong, 'tSong', song.era.name);
    setText(el.trkPos, 'tPos', hex2(st.pos));
    setText(el.trkPat, 'tPat', hex2(st.pat));
    setText(el.trkRow, 'tRow', hex2(st.row));
    setText(el.trkBpm, 'tBpm', String(Math.round(Music.bpm)).padStart(3, '0'));
    const ord = song.orders[Music.mode] || [];
    setHTML(el.trkPatName, 'tPN', `PATTERN ${hex2(st.pat)} · ${esc(song.pats[st.pat].name)} &nbsp;&nbsp; <span style="color:#6d78a8">ORDER[${Music.mode.toUpperCase()}]:</span> ` +
      ord.map((p, i) => i === st.pos ? `<b style="color:#7dff6a">[${hex2(p)}]</b>` : hex2(p)).join(' '));
    for (const b of el.trkOrders.children) b.classList.toggle('on', +b.dataset.pat === st.pat);
    for (const b of el.trkSongs.children) b.classList.toggle('on', +b.dataset.era === song.eraIdx);
    for (const b of el.trkModes.children) b.classList.toggle('on', b.dataset.mode === Music.mode);
    const anySolo = Music.solo.some(Boolean);
    trkChEls.forEach((c, i) => {
      c.vu.style.width = Math.min(100, Music.level[i] * 100).toFixed(0) + '%';
      c.m.classList.toggle('on', Music.mute[i]); c.s.classList.toggle('on', Music.solo[i]);
      const silent = anySolo ? !Music.solo[i] : Music.mute[i];
      c.d.classList.toggle('muted', silent);
    });
    if (cache.mix !== Music.mute.join() + Music.solo.join()) {
      cache.mix = Music.mute.join() + Music.solo.join();
      const cols = trkChEls.map((c, i) => anySolo ? !Music.solo[i] : Music.mute[i]);
      const sheet = cols.map((m, i) => m ? `#trkGrid .trk-row .c:nth-child(${i + 2}){opacity:.25}` : '').join('');
      el.mixStyle.textContent = sheet;
    }
  }
  function onTrackerClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pat != null) Music.jump(+b.dataset.pat);
    else if (b.dataset.era != null) Music.setEra(+b.dataset.era);
    else if (b.dataset.mode) Music.setMode(b.dataset.mode);
    else if (b.dataset.m != null) Music.toggleMute(+b.dataset.m);
    else if (b.dataset.s != null) Music.toggleSolo(+b.dataset.s);
  }

  // ============================================================ HOOKS
  function onStageStart() { updateHUD(true); }
  function handleKey(code) {
    if (code === 'KeyC') { toggleCRT(); return true; }
    if (code === 'KeyM') { toggleSound(); return true; }
    if (code === 'KeyT') { if (Game.modal !== 'shop') toggleTracker(); return true; }
    if (trkOpen) {
      if (code === 'Escape') closeTracker();
      else if (/^Digit[1-8]$/.test(code)) Music.toggleMute(+code[5] - 1);
      else if (code === 'ArrowRight' || code === 'ArrowLeft') { const st = Music.state(); Music.jump((st.pat + (code === 'ArrowRight' ? 1 : 6)) % 7); }
      else if (code === 'ArrowUp' || code === 'ArrowDown') { const i = Music.song ? Music.song.eraIdx : 0; Music.setEra((i + (code === 'ArrowDown' ? 1 : 4)) % 5); }
      return true;
    }
    if (Game.modal === 'shop') {
      if (code === 'KeyB' || code === 'Escape') return false;
      if (/^Digit[1-6]$/.test(code)) selectSlot(Game.SLOTS[+code[5] - 1]);
      return true;
    }
    return false;
  }
  function frame() {
    uiFrame++;
    const lv = Music.level; for (let c = 0; c < lv.length; c++) lv[c] *= 0.9;
    if (Music.ready) Music.state();
    updateHUD(false);
    if (uiFrame % 2 === 0) drawAnalyser();
    if (uiFrame % 6 === 0) updateNowPlaying();
    if (Game.modal === 'shop') {
      tickDialogue(); drawCrispin();
      Game.drawShipPreview(dollSurf); GFX.presentSurface(dollSurf, el.dollCtx, el.dollImg);
      if (uiFrame % 10 === 0) setText(el.shopCredits, 'shopCr', String(Game.P.credits));
    }
    if (trkOpen) updateTracker();
    const lbl = Game.modal === 'shop' ? 'UNDOCK [B]' : 'SHOP DOCK [B]';
    setText(el.btnShop, 'btnShop', lbl);
    setText(el.btnTracker, 'btnTrk', trkOpen ? 'CLOSE TRACKER [T]' : 'TRACKER VIEW [T]');
  }

  function init() {
    for (const id of ['screen', 'hudStage', 'hudEpoch', 'hudScore', 'hudCredits', 'hudShield', 'hudChrono', 'hudLives', 'hudBombs', 'hudSpeed', 'hudNash', 'hudHard', 'hudSyn',
      'spec', 'scope', 'nowPlaying', 'btnTracker', 'btnShop', 'btnCrt', 'btnMute', 'shop', 'shopCredits', 'crispinSays', 'shopSyn', 'shopSlotTitle', 'shopItems', 'shopSupplies',
      'undock', 'tracker', 'trkSong', 'trkPos', 'trkPat', 'trkRow', 'trkBpm', 'trkClose', 'trkOrders', 'trkSongs', 'trkModes', 'trkPatName', 'trkChans', 'trkGrid']) el[id] = $(id);
    el.specCtx = el.spec.getContext('2d'); el.scopeCtx = el.scope.getContext('2d');
    el.slots = [...document.querySelectorAll('.slot[data-slot]')];
    el.mixStyle = document.createElement('style'); document.head.appendChild(el.mixStyle);
    const cc = $('crispin').getContext('2d'); crispin = { surf: GFX.makeSurface(112, 112), ctx: cc, img: cc.createImageData(112, 112) };
    const dc = $('doll').getContext('2d'); el.dollCtx = dc; el.dollImg = dc.createImageData(96, 96); dollSurf = GFX.makeSurface(96, 96);

    el.btnTracker.addEventListener('click', () => { if (Game.modal !== 'shop') toggleTracker(); });
    el.btnShop.addEventListener('click', () => { Music.init(); if (Game.modal === 'shop') Game.closeShop(); else if (Game.state === 'play' && !Game.modal) Game.openShop('dock'); });
    el.btnCrt.addEventListener('click', toggleCRT);
    el.btnMute.addEventListener('click', toggleSound);
    for (const b of document.querySelectorAll('[data-warp]')) b.addEventListener('click', () => warp(+b.dataset.warp));
    for (const b of el.slots) b.addEventListener('click', () => selectSlot(b.dataset.slot));
    el.shopItems.addEventListener('click', onShopClick);
    el.shopSupplies.addEventListener('click', onShopClick);
    el.undock.addEventListener('click', () => Game.closeShop());
    el.trkClose.addEventListener('click', closeTracker);
    el.tracker.addEventListener('click', onTrackerClick);
    el.tracker.addEventListener('mousedown', e => { if (e.target === el.tracker) closeTracker(); });
    // buttons must not keep keyboard focus (Space would re-click them)
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button')) e.target.closest('button').blur(); });
    window.addEventListener('resize', fit);
    fit();
    Game.init(el.screen);
    updateHUD(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);

  return { onStageStart, openShop, closeShop, handleKey, frame, fit };
})();
window.UI = UI; // game.js probes window.UI (top-level const is not a window property)
