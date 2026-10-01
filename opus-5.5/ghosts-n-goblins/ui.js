'use strict';
/* =============================================================================
 *  GHOSTS 'N GOBLINS · THE CURSED PC GAMING MUSEUM — ui.js
 *  Cabinet glue outside the framebuffer: integer screen scaling, CRT bezel
 *  toggle, sound / pause buttons, stage-warp selector and the side placard.
 * ===========================================================================*/
const UI = (() => {
  const $ = id => document.getElementById(id);
  const cache = {};
  const setText = (id, v) => { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } };

  function fit() {
    const main = $('main'), help = $('help'), bez = $('bezel'), side = $('side');
    const pad = bez.classList.contains('crt-off') ? 8 : 36;
    const sideW = side.offsetParent ? side.offsetWidth + 14 : 0;
    const availW = main.clientWidth - sideW - pad - 24, availH = main.clientHeight - help.offsetHeight - pad - 30;
    let s = Math.min(availW / 320, availH / 200);
    s = s >= 2 ? Math.floor(s) : Math.max(1, Math.floor(s * 2) / 2);
    const cv = $('screen');
    cv.style.width = 320 * s + 'px'; cv.style.height = 200 * s + 'px';
    help.style.maxWidth = Math.max(320 * s, 420) + 'px';
    document.documentElement.style.setProperty('--scan', s + 'px');
  }
  function toggleCRT() {
    const b = $('bezel'), on = b.classList.contains('crt-on');
    b.classList.toggle('crt-on', !on); b.classList.toggle('crt-off', on);
    $('btnCrt').textContent = on ? 'CRT BEZEL OFF [V]' : 'CRT BEZEL [V]';
    fit();
  }
  function toggleSound() { Music.init(); const on = Music.toggleSound(); $('btnMute').textContent = on ? 'SOUND ON [M]' : 'SOUND OFF [M]'; }
  function togglePause() { if (Game.state === 'play') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); }

  const ARMOR = { steel: 'STEEL', gold: 'GOLDEN', none: 'STRAWBERRY BOXERS' };
  const WNAME = { lance: 'LANCE', dagger: 'DAGGER', torch: 'HOLY WATER TORCH', axe: 'BATTLE AXE', cross: 'BOOMERANG CROSS' };
  function update() {
    const st = Game.state, S = Game.S, w = S.world;
    if ((st === 'play' || st === 'map' || st === 'clear') && w || st === 'map') {
      const def = Stages.LIST[Game.stage];
      setText('plStage', 'EXHIBIT ' + (Game.stage + 1) + ': ' + def.name);
      setText('plSub', def.sub);
      setText('plYear', def.year + ' · BOSS: ' + def.boss);
    } else {
      setText('plStage', st === 'ending' ? 'CURSE LIFTED' : st === 'gameover' ? 'GAME OVER' : 'INSERT COIN');
      setText('plSub', 'Six haunted exhibits of late-80s / early-90s PC classics.');
      setText('plYear', 'PRESS ENTER · KEYS 1-6 WARP');
    }
    const P = S.P;
    if (P) {
      setText('stArmor', P.form ? 'POSSESSING (' + P.form.form.toUpperCase() + ')' : ARMOR[P.armor]);
      setText('stWeapon', WNAME[P.weapon] || '-');
      setText('stAnvil', S.anvil ? (S.anvil.kind === 'gold' ? 'GOLD ANVIL OUT' : 'STEEL ANVIL OUT') : '-');
    }
    setTimeout(update, 250);
  }

  function init() {
    Game.init($('screen'));
    $('btnCrt').onclick = toggleCRT;
    $('btnMute').onclick = toggleSound;
    $('btnPause').onclick = togglePause;
    document.querySelectorAll('[data-warp]').forEach(b => { b.onclick = () => { Game.warp(+b.dataset.warp); b.blur(); }; });
    document.querySelectorAll('button').forEach(b => b.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') e.preventDefault(); }));
    window.addEventListener('keydown', e => {
      if (e.code === 'KeyV') toggleCRT();
      else if (e.code === 'KeyM') toggleSound();
    });
    window.addEventListener('resize', fit);
    fit(); update();
  }
  return { init, fit };
})();
window.UI = UI;
window.addEventListener('load', UI.init);
