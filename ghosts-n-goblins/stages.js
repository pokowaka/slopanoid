'use strict';
/* =============================================================================
 *  GHOSTS 'N GOBLINS · THE CURSED PC GAMING MUSEUM — stages.js
 *  Six haunted exhibits. Each stage = theme (palette, procedural tile painters,
 *  sky + far + mid parallax layers, weather) + a deterministic level script
 *  written in a tiny builder DSL (ground / pit / plat / ladder / plate+gate /
 *  spawn / zone / chest / deco / checkpoint / boss arena).
 *
 *  World grid: 16px tiles, 13 rows (208px), camera y fixed at 8.
 *  Tile codes: 0 empty · 1 solid · 2 one-way · 3 ladder · 4 spikes · 5 deadly
 *  liquid · 6 cracked · 7 ghost platform (boxers only) · 8 pressure plate ·
 *  9 gate · 10 crumble / drawbridge · 11 conveyor L · 12 conveyor R · 13 nukage
 * ===========================================================================*/
const TILE = { EMPTY: 0, SOLID: 1, ONEWAY: 2, LADDER: 3, SPIKES: 4, LIQUID: 5, CRACKED: 6, GHOST: 7, PLATE: 8, GATE: 9, CRUMBLE: 10, CONVL: 11, CONVR: 12, NUKAGE: 13 };
const Stages = (() => {
  const G = GFX, hex = G.hex, shade = G.shade, mix = G.mix, hash = G.hash;
  const ROWS = 13;

  // ============================================================ THEMES
  const THEMES = [
    { // 0 · Monkey Island
      sky: ['#07051a', '#2a1440', '#6a2a50'], stars: true, moon: { x: 250, y: 40, r: 22, c: '#f4ecc8' },
      weather: 'rain', lightning: true, fog: '#6a4a8a',
      mats: {
        earth: ['#4a3426', '#2c1e18', '#6a4c36', '#3a7a3a', '#1e4a24'],
        wood: ['#7a5230', '#4a2e18', '#a47444', '#c8a070'],
        hull: ['#4a3020', '#2a1a10', '#6a4a30', '#8a9a80'],
      },
      oneway: 'wood', ladder: '#8a6038', liquid: ['#0e2a44', '#1a4a6a', '#6ab0d0'], crumble: 'wood',
    },
    { // 1 · King's Quest
      sky: ['#0a1024', '#26385a', '#5a6a80'], stars: true, moon: { x: 70, y: 36, r: 16, c: '#dfe8f0' },
      weather: 'leaves', lightning: true, fog: '#5a7a8a',
      mats: { stone: ['#6a7488', '#343a4c', '#9aa4b8', '#4a7a3a', '#2a4a24'] },
      oneway: 'stone', ladder: '#7a5a38', liquid: ['#0e3a30', '#1a5a48', '#80c8a0'], crumble: 'wood',
    },
    { // 2 · Prince of Persia
      sky: ['#04040a', '#0c1020', '#1a2034'], stars: false,
      weather: 'dust', lightning: false, fog: '#3a4a6a',
      mats: { stone: ['#4a5878', '#1c2234', '#7a88a8', '#8a92a8', '#5a6278'] },
      oneway: 'stone', ladder: '#6a5030', liquid: ['#300808', '#601010', '#ff6040'], crumble: 'loose',
    },
    { // 3 · Lemmings
      sky: ['#140806', '#3a1808', '#7a3a10'], stars: false,
      weather: 'sparks', lightning: false, fog: '#aa5a20',
      mats: { metal: ['#5a5e6e', '#2a2c38', '#8a90a4', '#f0c020', '#1a1a1a'] },
      oneway: 'grate', ladder: '#9a9aa8', liquid: ['#a02a00', '#ff6a00', '#ffe060'], crumble: 'grate',
    },
    { // 4 · DOOM
      sky: ['#1a0404', '#4a140c', '#8a3a1a'], stars: false,
      weather: 'embers', lightning: true, fog: '#8a3a2a',
      mats: { tech: ['#6a5640', '#3a2e22', '#94806a', '#8a8c90', '#40ff40'] },
      oneway: 'grate', ladder: '#8a8c90', liquid: ['#1a5a10', '#30b020', '#b0ff60'], crumble: 'grate',
    },
    { // 5 · Throne of Astaroth-LeChuck-9000
      sky: ['#0a0006', '#2a0414', '#6a0a20'], stars: true, moon: { x: 160, y: 44, r: 26, c: '#ff5a3a' },
      weather: 'ash', lightning: true, fog: '#8a1a3a',
      mats: { obsidian: ['#2e1a3a', '#140a1c', '#4e2e5e', '#f0bd34', '#ff3a20'] },
      oneway: 'bone', ladder: '#c8b89a', liquid: ['#8a1000', '#ff4a00', '#ffd040'], crumble: 'bone',
    },
  ];

  // ============================================================ TILE PAINTERS
  const H = (x, y, s) => hash(x, y, s);
  function speckle(base, dk, lt, v, dens = 0.12) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const h = H(x, y, v * 13 + 5);
      if (h < dens) G.pset(x, y, dk); else if (h > 1 - dens * 0.6) G.pset(x, y, lt);
    }
  }
  function paintMat(mat, pal, top, v) {
    const [a, b, c, d, e] = pal;
    return G.makeSprite(16, 16, () => {
      if (mat === 'earth') {
        G.rect(0, 0, 16, 16, a); speckle(a, b, c, v);
        const sx = Math.floor(H(v, 1, 3) * 10) + 2, sy = Math.floor(H(v, 2, 3) * 8) + 5;
        G.disc(sx, sy, 1.6, c); G.pset(sx + 1, sy + 1, b);
        if (v === 3) { G.line(3, 12, 7, 10, G.hex('#e8e0c8')); G.disc(8, 10, 1.2, G.hex('#e8e0c8')); } // buried bone
        if (top) for (let x = 0; x < 16; x++) {
          const h = 3 + Math.floor(H(x, v, 9) * 3);
          G.rect(x, 0, 1, h, d); G.pset(x, h, e);
          if (H(x, v, 11) > 0.7) G.pset(x, 0, shade(d, 1.4));
        }
      } else if (mat === 'wood' || mat === 'hull') {
        G.rect(0, 0, 16, 16, a);
        for (const y of [4, 9, 15]) G.rect(0, y, 16, 1, b);
        for (let r = 0; r < 3; r++) { const jx = Math.floor(H(r, v, 21) * 14) + 1, y0 = [0, 5, 10][r]; G.rect(jx, y0, 1, r === 2 ? 5 : 4, b); G.pset(jx + 2, y0 + 1, c); }
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (H(x, y, v + 40) < 0.06) G.pset(x, y, shade(a, 0.85));
        if (mat === 'hull') { if (v === 2) { G.disc(8, 8, 3.5, b); G.ring(8, 8, 3.5, d); G.disc(8, 8, 2, G.hex('#e0ff80')); } if (v === 1) { G.pset(3, 12, d); G.pset(4, 12, d); G.pset(11, 6, d); } }
        if (top) { G.rect(0, 0, 16, 2, c); G.rect(0, 2, 16, 1, b); if (mat === 'wood') { G.pset(2, 6, d); G.pset(13, 11, d); } }
      } else if (mat === 'stone') {
        G.rect(0, 0, 16, 16, b);
        for (let r = 0; r < 2; r++) {
          const off = (r + v) & 1 ? 4 : -4;
          for (let bx = off - 8; bx < 16; bx += 8) {
            const x0 = bx + 1, y0 = r * 8 + 1, k = 0.9 + H(bx + 8, r, v) * 0.2, bc = shade(a, k);
            G.rect(x0, y0, 7, 7, bc); G.rect(x0, y0, 7, 1, c); G.rect(x0, y0, 1, 7, shade(c, 0.9));
            G.rect(x0, y0 + 6, 7, 1, shade(a, 0.7));
          }
        }
        speckle(a, shade(a, 0.75), shade(a, 1.15), v, 0.05);
        if (top) { G.rect(0, 0, 16, 2, d); for (let x = 0; x < 16; x++) if (H(x, v, 31) > 0.55) G.rect(x, 2, 1, 1 + Math.floor(H(x, v, 32) * 3), e); }
      } else if (mat === 'metal') {
        G.rect(0, 0, 16, 16, a); G.rect(0, 0, 16, 1, c); G.rect(0, 0, 1, 16, c); G.rect(15, 0, 1, 16, b); G.rect(0, 15, 16, 1, b);
        for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) { G.pset(x, y, c); G.pset(x + 1, y + 1, b); }
        if (v === 2) { G.rect(4, 6, 8, 4, b); G.rect(5, 7, 6, 2, shade(a, 0.8)); }
        if (v === 3) for (let i = 0; i < 4; i++) G.pset(5 + i * 2, 8, b);
        if (top) for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) G.pset(x, y, ((x + y) >> 2) & 1 ? d : e);
      } else if (mat === 'tech') {
        G.rect(0, 0, 16, 16, a);
        G.rect(0, 5, 16, 1, b); G.rect(0, 11, 16, 1, b); G.rect(0, 6, 16, 1, c);
        G.rect(v * 4 % 16, 0, 1, 16, b);
        if (v === 1) { G.rect(4, 7, 8, 3, G.hex('#202020')); G.rect(5, 8, 2, 1, e); G.rect(9, 8, 2, 1, G.hex('#ff4020')); }
        if (v === 3) { G.rect(2, 1, 12, 3, shade(a, 0.8)); G.hline(3, 12, 2, shade(a, 1.2)); }
        speckle(a, shade(a, 0.8), shade(a, 1.15), v, 0.04);
        if (top) { G.rect(0, 0, 16, 3, d); G.rect(0, 0, 16, 1, shade(d, 1.3)); G.rect(0, 3, 16, 1, b); }
      } else if (mat === 'obsidian') {
        G.rect(0, 0, 16, 16, a); speckle(a, b, c, v, 0.08);
        let x = H(v, 0, 51) * 16, y = 0; for (let i = 0; i < 18; i++) { G.pset(x, y, i % 3 ? shade(e, 0.7) : e); x += H(i, v, 52) * 2 - 1; y += 1; }
        if (top) { G.rect(0, 0, 16, 2, d); G.rect(0, 2, 16, 1, shade(d, 0.5)); for (let i = 1; i < 16; i += 5) G.pset(i, 1, shade(d, 1.3)); }
      }
    }, 0, 0);
  }
  function paintOneway(style, pal) {
    const [a, b, c] = pal;
    return G.makeSprite(16, 16, () => {
      if (style === 'wood') { G.rect(0, 0, 16, 5, G.hex('#8a5a30')); G.rect(0, 0, 16, 1, G.hex('#c08850')); G.rect(0, 4, 16, 1, G.hex('#4a2a14')); G.rect(3, 5, 2, 4, G.hex('#4a2a14')); G.rect(11, 5, 2, 4, G.hex('#4a2a14')); }
      else if (style === 'stone') { G.rect(0, 0, 16, 5, a); G.rect(0, 0, 16, 1, c); G.rect(0, 4, 16, 1, b); G.rect(7, 0, 1, 5, b); G.poly([4, 5, 12, 5, 9, 9, 7, 9], shade(a, 0.8)); }
      else if (style === 'grate') { G.rect(0, 0, 16, 4, G.hex('#5a5e6e')); for (let x = 1; x < 16; x += 3) G.rect(x, 1, 1, 2, G.hex('#16161e')); G.rect(0, 0, 16, 1, G.hex('#9a9eb0')); G.line(0, 4, 5, 9, G.hex('#3a3c48')); G.line(15, 4, 10, 9, G.hex('#3a3c48')); }
      else if (style === 'bone') { G.rect(0, 1, 16, 3, G.hex('#d8ccb0')); for (let x = 0; x < 16; x += 8) { G.disc(x + 1, 2, 2, G.hex('#ece4c8')); G.disc(x + 7, 2, 2, G.hex('#ece4c8')); } G.rect(0, 4, 16, 1, G.hex('#8a7a60')); }
    }, 0, 0);
  }
  function paintLadder(col) {
    const c = hex(col), d = shade(c, 0.6), l = shade(c, 1.3);
    return G.makeSprite(16, 16, () => { G.rect(2, 0, 2, 16, c); G.rect(12, 0, 2, 16, c); G.rect(2, 0, 1, 16, l); for (let y = 2; y < 16; y += 5) { G.rect(4, y, 8, 2, c); G.rect(4, y + 1, 8, 1, d); } }, 0, 0);
  }
  function paintSpikes() {
    return G.makeSprite(16, 16, () => {
      G.rect(0, 12, 16, 4, hex('#3a3444')); G.rect(0, 12, 16, 1, hex('#6a6478'));
      for (let i = 0; i < 4; i++) { const x = i * 4; G.poly([x, 12, x + 2, 2, x + 4, 12], hex('#b8bcd0')); G.line(x + 2, 3, x + 2, 11, hex('#f0f4ff')); G.pset(x + 2, 2, hex('#ff5a5a')); }
    }, 0, 0);
  }
  function paintLiquid(pal, top, f, nuk) {
    const [a, b, c] = pal.map(hex);
    return G.makeSprite(16, 16, () => {
      G.rect(0, 0, 16, 16, a);
      for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) if (((x + f * 2 + y * 3) & 7) < 2) G.pset(x, y + ((x >> 2) & 1), b);
      if (top) {
        G.rect(0, 0, 16, 5, b);
        for (let x = 0; x < 16; x++) { const h = Math.round(2 + Math.sin((x + f * 4) * 0.4) * 1.5); G.rect(x, 0, 1, h, 0); G.pset(x, h, c); }
      }
      if (nuk) for (let i = 0; i < 3; i++) { const bx = (i * 5 + f * 3) % 14 + 1, by = 12 - ((f * 3 + i * 4) % 10); G.ring(bx, by, 1.2, c); }
    }, 0, 0);
  }
  function paintCracked(base) {
    const s = G.makeSprite(16, 16, t => { t.d.set(base.d); const k = hex('#0a0608'); G.line(2, 0, 6, 6, k); G.line(6, 6, 4, 11, k); G.line(6, 6, 12, 8, k); G.line(12, 8, 15, 14, k); G.line(4, 11, 8, 15, k); G.pset(7, 5, hex('#ffffff')); G.pset(11, 9, hex('#ffffff')); }, 0, 0);
    return s;
  }
  function paintGhost() {
    const c = hex('#80f0ff'), d = hex('#2a8ab0');
    return G.makeSprite(16, 16, () => { G.rect(0, 0, 16, 6, d); G.rect(0, 0, 16, 1, c); G.rect(0, 5, 16, 1, c); for (let x = 1; x < 16; x += 4) G.rect(x, 1, 2, 4, shade(d, 1.4)); G.poly([3, 6, 13, 6, 8, 12], shade(d, 0.8)); }, 0, 0);
  }
  function paintPlate(base, down) {
    return G.makeSprite(16, 16, t => {
      t.d.set(base.d);
      const y = down ? 1 : 0; G.rect(2, y, 12, 3, hex('#8a8aa0')); G.rect(2, y, 12, 1, hex('#e0e0f0')); G.rect(2, y + 3, 12, 1, hex('#2a2a38'));
      G.pset(8, y + 1, down ? hex('#40ff60') : hex('#ff4040'));
    }, 0, 0);
  }
  function paintGate(bottom) {
    const c = hex('#5a5a6a'), l = hex('#9a9aae'), d = hex('#2a2a36');
    return G.makeSprite(16, 16, () => {
      for (const x of [1, 6, 11]) { G.rect(x, 0, 3, 16, c); G.rect(x, 0, 1, 16, l); G.rect(x + 2, 0, 1, 16, d); }
      G.rect(0, 4, 16, 2, c); G.rect(0, 4, 16, 1, l); G.rect(0, 12, 16, 2, c);
      if (bottom) for (const x of [1, 6, 11]) G.poly([x, 13, x + 3, 13, x + 1.5, 16], l);
    }, 0, 0);
  }
  function paintCrumble(style, pal) {
    return G.makeSprite(16, 16, () => {
      if (style === 'wood') {
        G.rect(0, 0, 16, 7, hex('#7a4e28')); for (let x = 0; x < 16; x += 4) { G.rect(x, 0, 1, 7, hex('#3a200e')); G.pset(x + 2, 1, hex('#c09058')); }
        G.rect(0, 0, 16, 1, hex('#b08050')); G.rect(0, 7, 16, 1, hex('#2a1608'));
        G.line(0, 8, 15, 12, hex('#6a6a70')); G.pset(15, 12, hex('#aaaab0'));
      } else if (style === 'loose') {
        const [a, b, c] = pal; G.rect(0, 0, 16, 8, a); G.rect(0, 0, 16, 1, c); G.rect(0, 7, 16, 1, b); G.rect(5, 0, 1, 8, b); G.rect(11, 2, 1, 6, b); G.pset(3, 3, b); G.pset(13, 5, c);
      } else if (style === 'grate') {
        G.rect(0, 0, 16, 5, hex('#8a5a3a')); for (let x = 1; x < 16; x += 3) G.rect(x, 1, 1, 3, hex('#2a1810')); G.rect(0, 0, 16, 1, hex('#c09060')); G.pset(3, 4, hex('#ff8040')); G.pset(12, 4, hex('#ff8040'));
      } else {
        G.rect(0, 1, 16, 4, hex('#c8b89a')); for (let x = 1; x < 16; x += 5) G.disc(x, 3, 2, hex('#ece4c8')); G.rect(0, 5, 16, 1, hex('#6a5a40')); G.pset(7, 2, hex('#1e1a2a'));
      }
    }, 0, 0);
  }
  function paintConveyor(dir, f) {
    return G.makeSprite(16, 16, () => {
      G.rect(0, 0, 16, 16, hex('#2a2c36')); G.rect(0, 0, 16, 5, hex('#1a1a20'));
      for (let x = 0; x < 16; x++) { const p = (x + (dir > 0 ? -f : f) * 2 + 32) % 8; if (p < 3) G.pset(x, 1 + (p === 1 ? 0 : 1), hex('#f0c020')), G.pset(x, 3 - (p === 1 ? 0 : 1), hex('#f0c020')); }
      G.rect(0, 5, 16, 1, hex('#5a5e6e'));
      for (const cx of [4, 12]) { G.disc(cx, 10, 3, hex('#4a4e5e')); const a = f * 0.8 * dir; G.pset(cx + Math.round(Math.cos(a) * 2), 10 + Math.round(Math.sin(a) * 2), hex('#9a9eb0')); }
    }, 0, 0);
  }

  function buildTileset(th) {
    const ts = { mats: {} };
    for (const m in th.mats) {
      ts.mats[m] = { top: [0, 1, 2, 3].map(v => paintMat(m, th.mats[m].map(hex), true, v)), in: [0, 1, 2, 3].map(v => paintMat(m, th.mats[m].map(hex), false, v)) };
    }
    const m0 = Object.keys(th.mats)[0], mp = th.mats[m0].map(hex);
    ts.oneway = paintOneway(th.oneway, mp);
    ts.ladder = paintLadder(th.ladder);
    ts.spikes = paintSpikes();
    const nuk = [hex('#1a5a10'), hex('#30b020'), hex('#b0ff60')];
    ts.liq = [0, 1, 2, 3].map(f => paintLiquid(th.liquid, false, f, false));
    ts.liqTop = [0, 1, 2, 3].map(f => paintLiquid(th.liquid, true, f, false));
    ts.nuk = [0, 1, 2, 3].map(f => paintLiquid(['#1a5a10', '#30b020', '#b0ff60'], false, f, true));
    ts.nukTop = [0, 1, 2, 3].map(f => paintLiquid(['#1a5a10', '#30b020', '#b0ff60'], true, f, true));
    void nuk;
    ts.cracked = {}; for (const m in ts.mats) ts.cracked[m] = [paintCracked(ts.mats[m].top[1]), paintCracked(ts.mats[m].in[1])];
    ts.ghost = paintGhost();
    ts.plate = {}; for (const m in ts.mats) ts.plate[m] = [paintPlate(ts.mats[m].top[0], false), paintPlate(ts.mats[m].top[0], true)];
    ts.gate = paintGate(false); ts.gateBot = paintGate(true);
    ts.crumble = paintCrumble(th.crumble, mp);
    ts.conv = { '-1': [0, 1, 2, 3].map(f => paintConveyor(-1, f)), 1: [0, 1, 2, 3].map(f => paintConveyor(1, f)) };
    return ts;
  }

  // ============================================================ SKY & PARALLAX
  function buildSky(th, idx) {
    const buf = new Uint32Array(320 * 200);
    const s = { w: 320, h: 200, d: buf };
    G.target(s);
    const c = th.sky.map(hex);
    for (let y = 0; y < 200; y++) { const k = y / 199; const col = k < 0.55 ? mix(c[0], c[1], k / 0.55) : mix(c[1], c[2], (k - 0.55) / 0.45); G.rect(0, y, 320, 1, col); }
    // ordered-dither banding like a VGA palette
    for (let y = 0; y < 200; y += 2) for (let x = (y >> 1) & 1; x < 320; x += 4) G.pset(x, y, shade(G.pget(x, y), 1.06));
    if (th.stars) for (let i = 0; i < 90; i++) { const x = H(i, 1, idx) * 320, y = H(i, 2, idx) * 120; G.pset(x, y, H(i, 3, idx) > 0.8 ? hex('#ffffff') : hex('#8a8ab0')); }
    if (th.moon) { const m = th.moon, mc = hex(m.c); G.glow(m.x, m.y, m.r * 2.6, mc, 0.35); G.disc(m.x, m.y, m.r, mc); G.disc(m.x - m.r * 0.3, m.y - m.r * 0.2, m.r * 0.25, shade(mc, 0.88)); G.disc(m.x + m.r * 0.35, m.y + m.r * 0.3, m.r * 0.18, shade(mc, 0.85)); }
    // wispy cloud bands
    for (let i = 0; i < 7; i++) { const y = 20 + H(i, 5, idx) * 90, x = H(i, 6, idx) * 320, w = 60 + H(i, 7, idx) * 90; for (let k = 0; k < w; k++) G.blend(x + k - 40, y + Math.sin(k * 0.08) * 2, shade(c[2], 1.15), 0.35); }
    G.target(null);
    return buf;
  }
  function silhouette(w, h, col, fn) { return G.makeSprite(w, h, () => fn(hex(col)), 0, 0); }
  function jaggedHills(w, h, base, amp, fr, seed, c) {
    for (let x = 0; x < w; x++) {
      const y = base + Math.sin((x / w) * Math.PI * 2 * fr + seed) * amp + Math.sin((x / w) * Math.PI * 2 * fr * 3.1 + seed * 2) * amp * 0.35;
      G.rect(x, y, 1, h - y, c);
    }
  }
  function tree(x, y, len, ang, depth, c) {
    const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
    G.thick(x, y, x2, y2, Math.max(0.5, depth * 0.55), c);
    if (depth <= 0) return;
    tree(x2, y2, len * 0.72, ang - 0.5 - H(x | 0, depth, 3) * 0.3, depth - 1, c);
    tree(x2, y2, len * 0.66, ang + 0.45 + H(y | 0, depth, 4) * 0.3, depth - 1, c);
  }
  const FAR = [
    // Monkey Island: Melee Island hills, lookout, Scumm Bar lights, masts on the horizon
    () => silhouette(512, 110, '#1c1030', c => {
      jaggedHills(512, 110, 60, 18, 2, 1, c);
      G.rect(120, 22, 6, 40, c); G.poly([114, 22, 132, 22, 123, 12], c); G.rect(121, 26, 3, 3, hex('#ffd060')); // lookout
      G.rect(300, 55, 60, 30, c); G.poly([296, 55, 364, 55, 330, 40], c);
      for (let i = 0; i < 5; i++) G.rect(306 + i * 11, 64, 4, 5, hex('#ffb040'));
      for (const mx of [30, 420, 470]) { G.rect(mx, 50, 2, 45, c); G.rect(mx - 10, 58, 22, 2, c); G.rect(mx - 7, 70, 16, 2, c); }
      G.rect(0, 96, 512, 14, hex('#12203a'));
      for (let x = 0; x < 512; x += 3) G.pset(x, 96 + (x * 7 % 5), hex('#3a5a80'));
    }),
    // Daventry: castle towers with pennants
    () => silhouette(512, 120, '#1a2436', c => {
      jaggedHills(512, 120, 80, 10, 3, 2, shade(c, 1.2));
      const tw = (x, w, h) => { G.rect(x, 120 - h, w, h, c); for (let i = 0; i < w; i += 4) G.rect(x + i, 120 - h - 3, 2, 3, c); G.poly([x - 2, 120 - h - 3, x + w + 2, 120 - h - 3, x + w / 2, 120 - h - 16], c); G.rect(x + w / 2, 120 - h - 24, 1, 8, c); G.poly([x + w / 2 + 1, 120 - h - 24, x + w / 2 + 7, 120 - h - 22, x + w / 2 + 1, 120 - h - 20], hex('#8a2a3a')); };
      G.rect(180, 60, 150, 60, c); for (let i = 180; i < 330; i += 6) G.rect(i, 56, 3, 4, c);
      tw(170, 16, 80); tw(240, 22, 100); tw(320, 16, 78); tw(60, 12, 55); tw(430, 14, 64);
      for (let i = 0; i < 9; i++) G.rect(200 + i * 14, 80 + (i & 1) * 12, 2, 4, hex('#e8c060'));
    }),
    // Persia: dungeon arches and a distant palace window
    () => silhouette(512, 150, '#0e1220', c => {
      G.rect(0, 0, 512, 150, c);
      for (let y = 0; y < 150; y += 10) for (let x = (y / 10 & 1) * 12; x < 512; x += 24) G.frame(x, y, 24, 10, shade(c, 1.35));
      for (let x = 30; x < 512; x += 128) { G.rect(x, 40, 40, 80, hex('#05060c')); G.ellipse(x + 20, 40, 20, 18, hex('#05060c')); G.rect(x + 12, 70, 16, 30, hex('#1a2440')); G.ellipse(x + 20, 70, 8, 8, hex('#1a2440')); for (let k = 0; k < 3; k++) G.rect(x + 14 + k * 5, 62, 1, 38, hex('#05060c')); }
    }),
    // Lemmings foundry: chimneys, gantries
    () => silhouette(512, 130, '#2a1208', c => {
      jaggedHills(512, 130, 100, 6, 4, 3, c);
      for (let i = 0; i < 6; i++) { const x = 20 + i * 86, h = 60 + H(i, 1, 9) * 40; G.rect(x, 130 - h, 18, h, c); G.rect(x - 2, 130 - h, 22, 4, c); }
      G.rect(120, 70, 200, 60, c); for (let x = 130; x < 310; x += 20) G.rect(x, 84, 10, 6, hex('#ff8a20'));
      for (let x = 0; x < 512; x += 16) G.line(x, 60, x + 8, 50, shade(c, 1.4));
      G.rect(0, 60, 512, 2, shade(c, 1.4)); G.rect(0, 50, 512, 1, shade(c, 1.4));
    }),
    // Phobos: jagged mars mountains, UAC base
    () => silhouette(512, 120, '#3a1008', c => {
      for (let x = 0; x < 512; x++) { const y = 60 + Math.abs(((x * 7) % 90) - 45) * 0.7 + Math.sin(x * 0.05) * 8; G.rect(x, y, 1, 120 - y, c); }
      G.rect(200, 70, 120, 50, shade(c, 0.7)); G.rect(250, 50, 20, 20, shade(c, 0.7)); G.rect(254, 40, 4, 10, shade(c, 0.7));
      for (let x = 206; x < 320; x += 12) G.rect(x, 84, 6, 3, hex('#ffe060'));
    }),
    // Throne: floating skulls & floppies over a pit of flames
    () => silhouette(512, 150, '#2a0414', c => {
      for (let i = 0; i < 7; i++) { const x = 30 + i * 72, y = 30 + H(i, 3, 5) * 50; G.disc(x, y, 12, c); G.rect(x - 7, y + 8, 14, 8, c); G.disc(x - 4, y, 3, hex('#ff3a20')); G.disc(x + 4, y, 3, hex('#ff3a20')); }
      for (let i = 0; i < 5; i++) { const x = 60 + i * 100, y = 100 + H(i, 8, 5) * 20; G.rect(x, y, 16, 16, shade(c, 1.4)); G.rect(x + 4, y, 8, 5, hex('#9a9ab0')); }
      jaggedHills(512, 150, 130, 6, 6, 1, shade(c, 0.6));
    }),
  ];
  const MID = [
    () => silhouette(480, 90, '#140c1e', c => {
      for (let i = 0; i < 9; i++) { const x = 10 + i * 53 + H(i, 1, 1) * 20; if (i % 3 === 0) tree(x, 90, 22, -0.1, 4, c); else { G.rect(x, 70, 10, 20, c); G.ellipse(x + 5, 70, 5, 4, c); } }
      for (let x = 0; x < 480; x += 8) { G.rect(x, 78, 1, 12, c); G.pset(x, 77, c); } G.rect(0, 82, 480, 1, c);
    }),
    () => silhouette(480, 100, '#101a24', c => {
      for (let i = 0; i < 8; i++) { const x = 20 + i * 60; G.rect(x + 8, 60, 6, 40, c); G.disc(x + 11, 50, 18 + H(i, 1, 2) * 8, c); G.disc(x, 60, 12, c); G.disc(x + 22, 58, 12, c); }
    }),
    () => silhouette(480, 150, '#0a0e1a', c => {
      for (let x = 0; x < 480; x += 120) { G.rect(x + 40, 0, 26, 150, c); G.rect(x + 36, 0, 34, 8, c); G.rect(x + 36, 140, 34, 10, c); for (let y = 10; y < 140; y += 16) G.rect(x + 44, y, 18, 1, shade(c, 1.6)); }
      for (let x = 0; x < 480; x += 4) G.pset(x, 20 + Math.sin(x * 0.05) * 3, shade(c, 1.8));
    }),
    () => silhouette(480, 120, '#1a0c06', c => {
      for (let x = 0; x < 480; x += 60) { G.rect(x, 0, 6, 120, c); for (let y = 0; y < 120; y += 20) { G.line(x, y, x + 60, y + 20, c); G.line(x + 60, y, x, y + 20, c); } }
      G.rect(0, 0, 480, 6, c);
      for (let i = 0; i < 4; i++) { const cx = 60 + i * 120, cy = 70; G.disc(cx, cy, 18, c); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; G.disc(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20, 3, c); } G.disc(cx, cy, 6, hex('#2a1208')); }
    }),
    () => silhouette(480, 110, '#200a06', c => {
      for (let x = 0; x < 480; x += 80) { G.rect(x + 10, 20, 24, 90, c); G.rect(x + 6, 16, 32, 6, c); G.rect(x + 16, 40, 12, 3, hex('#40ff40')); G.rect(x + 16, 60, 12, 3, hex('#ff4020')); }
      for (let x = 0; x < 480; x += 3) G.pset(x, 105, shade(c, 1.8));
    }),
    () => silhouette(480, 140, '#1a0010', c => {
      for (let x = 0; x < 480; x += 96) { G.rect(x + 20, 10, 20, 130, c); for (let y = 16; y < 140; y += 14) { G.disc(x + 30, y, 6, c); G.pset(x + 28, y, hex('#ff3a20')); G.pset(x + 32, y, hex('#ff3a20')); } }
      for (let x = 0; x < 480; x += 24) for (let y = 0; y < 60; y += 4) G.pset(x + 70, y, c);
    }),
  ];

  // ============================================================ DECOS
  const DECO = {};
  function buildDecos() {
    const stoneC = hex('#8a8aa0'), stoneD = hex('#4a4a60'), stoneL = hex('#c0c0d4');
    DECO.tomb = Sprites.finish(G.makeSprite(14, 18, () => { G.rect(1, 6, 12, 12, stoneC); G.ellipse(7, 6, 6, 5, stoneC); G.rect(6, 4, 2, 8, stoneD); G.rect(4, 6, 6, 2, stoneD); G.rect(1, 16, 12, 2, stoneD); }, 7, 17));
    DECO.tomb2 = Sprites.finish(G.makeSprite(12, 14, () => { G.rect(1, 2, 10, 12, stoneC); G.rect(1, 2, 10, 2, stoneL); G.text('RIP', 1, 5, stoneD); }, 6, 13), false);
    DECO.cross = Sprites.finish(G.makeSprite(12, 20, () => { G.rect(5, 0, 3, 20, hex('#6a4a2a')); G.rect(0, 4, 12, 3, hex('#6a4a2a')); }, 6, 19));
    DECO.tree = G.makeSprite(60, 70, () => tree(30, 70, 22, 0.05, 5, hex('#1e1420')), 30, 69);
    DECO.fence = G.makeSprite(16, 16, () => { const c = hex('#2a2230'); for (let x = 1; x < 16; x += 5) { G.rect(x, 2, 1, 14, c); G.poly([x - 1, 3, x + 1.5, 0, x + 2, 3], c); } G.rect(0, 6, 16, 1, c); G.rect(0, 13, 16, 1, c); }, 8, 15);
    DECO.torch = Sprites.finish(G.makeSprite(8, 10, () => { G.rect(2, 3, 4, 7, hex('#5a3a1a')); G.rect(0, 2, 8, 2, hex('#8a8a9a')); }, 4, 9));
    DECO.window = G.makeSprite(22, 34, () => { G.rect(1, 10, 20, 24, hex('#1a2a4a')); G.ellipse(11, 10, 10, 10, hex('#1a2a4a')); G.rect(1, 14, 20, 20, hex('#2a3a6a')); for (let x = 5; x < 20; x += 5) G.rect(x, 4, 1, 30, hex('#0a0a14')); G.rect(1, 20, 20, 1, hex('#0a0a14')); G.frame(0, 10, 22, 24, stoneD); }, 11, 33);
    DECO.banner = Sprites.finish(G.makeSprite(14, 30, () => { G.rect(0, 0, 14, 2, hex('#c8a040')); G.poly([1, 2, 13, 2, 13, 29, 7, 24, 1, 29], hex('#8a1a2a')); G.disc(7, 11, 3, hex('#f0c848')); G.rect(6, 8, 2, 7, hex('#8a1a2a')); }, 7, 0));
    DECO.mast = G.makeSprite(70, 150, () => {
      G.rect(33, 0, 5, 150, hex('#4a2e18')); G.rect(34, 0, 1, 150, hex('#7a5230'));
      G.rect(8, 22, 56, 3, hex('#4a2e18')); G.rect(14, 70, 44, 3, hex('#4a2e18'));
      const sail = hex('#9ac8a8');
      for (let y = 25; y < 68; y++) for (let x = 10; x < 62; x++) { const e = Math.sin((y - 25) / 43 * Math.PI) * 5; if (x > 10 + e && x < 62 - e * 0.3 && H(x, y, 77) > 0.12) G.blend(x, y, sail, 0.45 + H(x >> 2, y >> 2, 1) * 0.2); }
      G.line(36, 0, 8, 22, hex('#2a1a0e')); G.line(36, 0, 64, 22, hex('#2a1a0e'));
      G.poly([37, 0, 52, 4, 37, 8], hex('#1a1a1a')); G.disc(43, 4, 1.5, hex('#e8e0c8'));
    }, 35, 149);
    DECO.rail = G.makeSprite(16, 10, () => { const c = hex('#6a4424'); G.rect(0, 0, 16, 2, hex('#8a5a30')); for (let x = 2; x < 16; x += 5) G.rect(x, 2, 2, 8, c); }, 8, 9);
    DECO.barrel = Sprites.finish(G.makeSprite(12, 14, () => { G.ellipse(6, 7, 5.5, 7, hex('#7a4a22')); G.rect(0, 3, 12, 1, hex('#3a3a44')); G.rect(0, 10, 12, 1, hex('#3a3a44')); }, 6, 13));
    DECO.skulls = Sprites.finish(G.makeSprite(18, 10, () => { for (const [x, y] of [[4, 6], [10, 6], [15, 7], [7, 2]]) { G.disc(x, y, 3, hex('#ece4c8')); G.pset(x - 1, y, hex('#1e1a2a')); G.pset(x + 1, y, hex('#1e1a2a')); } }, 9, 9));
    DECO.sign = Sprites.finish(G.makeSprite(4, 18, () => { G.rect(1, 0, 2, 18, hex('#5a3a1a')); }, 2, 17), false);
    DECO.pillar = G.makeSprite(20, 160, () => { const c = hex('#3a4460'), l = hex('#5a6480'); G.rect(3, 0, 14, 160, c); G.rect(4, 0, 2, 160, l); G.rect(0, 0, 20, 8, l); G.rect(0, 150, 20, 10, l); for (let y = 12; y < 150; y += 20) G.rect(3, y, 14, 1, hex('#1e2436')); }, 10, 159);
    DECO.chain = G.makeSprite(6, 48, () => { for (let y = 0; y < 48; y += 5) G.ring(3, y + 2, 2, hex('#6a6a7a')); }, 3, 0);
    DECO.gear = Sprites.finish(G.makeSprite(34, 34, () => { const c = hex('#5a4a3a'); G.disc(17, 17, 12, c); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; G.disc(17 + Math.cos(a) * 13, 17 + Math.sin(a) * 13, 3, c); } G.disc(17, 17, 5, hex('#2a1a10')); G.disc(17, 17, 2, c); }, 17, 17), false);
    DECO.pipe = G.makeSprite(12, 120, () => { G.rect(1, 0, 10, 120, hex('#4a4e5a')); G.rect(3, 0, 2, 120, hex('#7a7e8a')); for (let y = 10; y < 120; y += 30) G.rect(0, y, 12, 4, hex('#6a6e7a')); }, 6, 119);
    DECO.panel = Sprites.finish(G.makeSprite(26, 30, () => { G.rect(0, 0, 26, 30, hex('#5a5a5e')); G.rect(3, 3, 20, 14, hex('#101418')); G.rect(3, 20, 20, 7, hex('#3a3a40')); }, 13, 29), false);
    DECO.lamp = G.makeSprite(8, 6, () => { G.rect(0, 0, 8, 6, hex('#6a6a70')); G.rect(1, 1, 6, 4, hex('#e8f0ff')); }, 4, 5);
    DECO.throne = Sprites.finish(G.makeSprite(30, 40, () => { G.rect(2, 0, 26, 40, hex('#4a0a1a')); G.rect(0, 20, 30, 6, hex('#6a1a2a')); G.disc(15, 8, 6, hex('#f0bd34')); G.disc(15, 8, 3, hex('#4a0a1a')); }, 15, 39));
    DECO.flagpole = SPR.flag; DECO.flagOn = SPR.flagOn;
    DECO.statue = SPR.arremer_stone.fold;
    DECO.bones = SPR.bonePile;
    DECO.hatchD = SPR.hatch;
    DECO.exit = Sprites.finish(G.makeSprite(26, 12, () => { G.rect(0, 0, 26, 12, hex('#1a1a1a')); G.text('EXIT', 2, 3, hex('#ff3030')); }, 13, 11), false);
  }
  function drawDeco(d, X, Y, t) {
    const s = DECO[d.type];
    if (d.type === 'sign') {
      G.blit(s, X, Y);
      const w = G.textW(d.text) + 6;
      G.rect(X - w / 2, Y - 30, w, 12, hex('#8a6038')); G.frame(X - w / 2, Y - 30, w, 12, hex('#3a2010')); G.rect(X - w / 2 + 1, Y - 29, w - 2, 1, hex('#b08050'));
      G.text(d.text, X - w / 2 + 3, Y - 27, hex('#f8f0d0'));
      return;
    }
    if (d.type === 'gear') { G.blitRot(s, X, Y - 17, t * 0.02 * (d.dir || 1), false); return; }
    if (d.type === 'torch') {
      G.blit(s, X, Y);
      const f = (t >> 2) & 3, fl = [hex('#ff6010'), hex('#ffb020'), hex('#fff080')];
      G.glow(X, Y - 13, 26 + Math.sin(t * 0.3) * 3, hex('#ff8a30'), 0.35);
      G.ellipse(X, Y - 13, 3, 5 + (f & 1), fl[0]); G.ellipse(X + (f === 2 ? 1 : 0), Y - 12, 2, 3 + (f & 1), fl[1]); G.pset(X, Y - 11, fl[2]);
      return;
    }
    if (d.type === 'panel') {
      G.blit(s, X, Y);
      for (let i = 0; i < 12; i++) { const on = ((t >> 4) + i * 7) % 5 < 2; G.pset(X - 9 + (i % 6) * 3, Y - 25 + ((i / 6) | 0) * 3, on ? (i & 1 ? hex('#40ff40') : hex('#ff4040')) : hex('#203020')); }
      for (let i = 0; i < 16; i++) G.pset(X - 9 + i, Y - 20 - Math.round(Math.abs(Math.sin((t + i * 5) * 0.08)) * 5), hex('#40c0ff'));
      return;
    }
    if (d.type === 'lamp') { G.blit(s, X, Y); G.glow(X, Y - 3, 20, hex('#c0d8ff'), 0.25); return; }
    if (d.type === 'lantern') {
      const sw = Math.sin(t * 0.03 + X) * 3;
      G.line(X, Y - 40, X + sw, Y - 12, hex('#3a3a44'));
      G.rect(X + sw - 3, Y - 12, 6, 8, hex('#3a2a1a')); G.rect(X + sw - 2, Y - 11, 4, 6, hex('#ffd060'));
      G.glow(X + sw, Y - 8, 22, hex('#ffb040'), 0.3); return;
    }
    if (d.type === 'flag') { G.blit(d.on ? DECO.flagOn : DECO.flagpole, X, Y); return; }
    if (s) G.blit(s, X, Y, d.flip);
  }

  // ============================================================ BUILDER DSL
  function Builder(w, theme) {
    const t = new Uint8Array(w * ROWS);
    const W = { w, h: ROWS, t, spawns: [], zones: [], chests: [], decos: [], checks: [], plates: [], gates: {}, wind: [], rock: null, arena: null, mat: null, theme };
    const set = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < ROWS) t[y * w + x] = c; };
    const b = {
      W, set,
      fill(x0, x1, y0, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); return b; },
      ground(x0, x1, top = 11) { return b.fill(x0, x1, top, ROWS - 1, 1); },
      pit(x0, x1) { return b.fill(x0, x1, 0, ROWS - 1, 0); },
      liquid(x0, x1, top = 11, c = 5) { b.fill(x0, x1, 0, ROWS - 1, 0); return b.fill(x0, x1, top, ROWS - 1, c); },
      plat(x0, x1, y, c = 2) { return b.fill(x0, x1, y, y, c); },
      solid(x0, x1, y0, y1) { return b.fill(x0, x1, y0, y1, 1); },
      ladder(x, y0, y1) { return b.fill(x, x, y0, y1, 3); },
      // entities / props stand ON TOP of tile row `ty` (feet y = ty*16)
      spawn(type, tx, ty, o = {}) { W.spawns.push({ type, x: tx * 16 + 8, y: ty * 16, o }); return b; },
      zone(x0, x1, type, rate, max = 3, o = {}) { W.zones.push({ x0: x0 * 16, x1: (x1 + 1) * 16, type, rate, max, o, cd: rate >> 1 }); return b; },
      chest(kind, tx, ty) { W.chests.push({ kind, x: tx * 16 + 8, y: ty * 16 }); return b; },
      deco(type, tx, ty, o = {}) { W.decos.push(Object.assign({ type, x: tx * 16 + 8, y: ty * 16 }, o)); return b; },
      check(tx, ty = 11) { W.checks.push({ x: tx * 16 + 8, y: ty * 16 }); W.decos.push({ type: 'flag', x: tx * 16 + 8, y: ty * 16, check: W.checks.length - 1 }); return b; },
      plate(tx, ty, group, action = 'gate') { set(tx, ty, 8); W.plates.push({ tx, ty, group, action, done: false }); return b; },
      gate(tx, y0, y1, group) { for (let y = y0; y <= y1; y++) { set(tx, y, 9); (W.gates[group] = W.gates[group] || []).push({ tx, ty: y }); } return b; },
      arena(x0, boss, o = {}) { W.arena = Object.assign({ x0, x: x0 * 16, boss }, o); return b; },
      rock(x0, x1) { W.rock = { x0: x0 * 16, x1: (x1 + 1) * 16 }; return b; },
      wind(x0, x1) { W.wind.push([x0 * 16, (x1 + 1) * 16]); return b; },
      scatter(x0, x1, type, every, ty = 11, seed = 1) { for (let x = x0; x <= x1; x += every) if (H(x, seed, 99) > 0.35) W.decos.push({ type, x: x * 16 + 8 + Math.floor(H(x, seed, 98) * 8) - 4, y: ty * 16, flip: H(x, seed, 97) > 0.5 }); return b; },
    };
    return b;
  }

  // ============================================================ STAGE SCRIPTS
  const LIST = [
    {
      name: "LECHUCK'S GHOST SHIP", sub: '& THE MELEE ISLAND GRAVEYARD', year: 'MONKEY ISLAND · 1990', boss: 'GHOST PIRATE LECHUCK', map: [52, 128], w: 200,
      build(b) {
        b.ground(0, 76);
        b.deco('sign', 3, 11, { text: 'MELEE ISLAND' });
        b.scatter(5, 74, 'tomb', 5, 11, 1); b.scatter(7, 74, 'cross', 9, 11, 2); b.scatter(2, 70, 'fence', 3, 11, 3);
        b.deco('tree', 12, 11); b.deco('tree', 38, 11); b.deco('tree', 66, 11);
        b.solid(14, 17, 10, 10); b.solid(22, 25, 9, 10); b.deco('tomb', 23, 9); b.deco('tomb2', 25, 9);
        b.pit(28, 29); b.plat(31, 34, 8); b.deco('skulls', 32, 8);
        b.solid(36, 44, 7, 10); b.ladder(35, 7, 10); b.chest('T', 41, 7); b.deco('cross', 37, 7); b.deco('cross', 43, 7);
        b.spawn('skeleton', 39, 7);
        b.pit(47, 48);
        b.fill(50, 53, 7, 7, 7); b.fill(55, 58, 5, 5, 7); b.chest('t', 57, 5);
        b.solid(60, 63, 10, 10);
        b.zone(4, 74, 'zombie', 100, 3, { v: 'zombie' });
        b.spawn('skull', 45, 7); b.spawn('skull', 58, 8); b.spawn('skull', 72, 6);
        b.check(66);
        b.deco('sign', 72, 11, { text: 'SHIP OF LECHUCK ->' });
        // the ghost ship
        b.liquid(77, 79); b.plat(77, 79, 10);
        b.solid(80, 150, 9, 12); b.rock(80, 150);
        b.deco('mast', 104, 9); b.deco('mast', 136, 9); b.scatter(80, 150, 'rail', 1, 9, 5);
        b.spawn('cannon', 90, 9, { face: -1 }); b.spawn('cannon', 113, 6, { face: -1 }); b.spawn('cannon', 146, 9, { face: -1 });
        b.fill(96, 97, 9, 10, 0); b.fill(96, 97, 11, 12, 5);
        b.ladder(105, 3, 8); b.plat(102, 104, 3); b.plat(106, 108, 3); b.chest('T', 107, 3);
        b.solid(118, 124, 6, 8); b.ladder(117, 6, 8); b.spawn('skeleton', 121, 6); b.deco('lantern', 120, 6); b.deco('barrel', 123, 6);
        b.fill(129, 130, 9, 10, 0); b.fill(129, 130, 11, 12, 5);
        b.ladder(137, 4, 8); b.plat(134, 136, 4); b.plat(138, 139, 4); b.fill(140, 146, 4, 4, 7); b.chest('t', 145, 4);
        b.deco('barrel', 84, 9); b.deco('barrel', 85, 9); b.deco('barrel', 140, 9);
        b.zone(82, 150, 'zombie', 110, 3, { v: 'pirate' });
        b.spawn('arremer', 126, 5);
        // back to shore
        b.liquid(151, 153); b.plat(151, 153, 10);
        b.ground(154, 199);
        b.check(158);
        b.scatter(160, 176, 'tomb', 3, 11, 7); b.deco('tree', 170, 11);
        b.zone(154, 175, 'zombie', 90, 3, { v: 'pirate' });
        b.spawn('skull', 168, 7);
        b.arena(178, 'ghostcap'); b.solid(198, 199, 0, 12);
      },
    },
    {
      name: 'THE HAUNTED MOAT', sub: 'OF CASTLE DAVENTRY', year: "KING'S QUEST · 1984", boss: 'THE MOAT DRAGON', map: [92, 70], w: 200,
      build(b) {
        b.ground(0, 20); b.deco('sign', 4, 11, { text: 'DAVENTRY' }); b.deco('tree', 9, 11); b.deco('tree', 17, 11);
        b.liquid(21, 57);
        b.fill(21, 29, 10, 10, 10);
        b.solid(30, 33, 9, 12); b.spawn('gargoyle', 32, 9);
        b.fill(34, 43, 10, 10, 10);
        b.fill(36, 41, 6, 6, 7); b.chest('t', 39, 6);
        b.solid(44, 50, 10, 12); b.plate(47, 10, 1); b.plate(48, 10, 1); b.chest('T', 45, 10);
        b.deco('sign', 49, 10, { text: 'HEAVY ONLY' });
        b.fill(51, 57, 10, 10, 10);
        b.spawn('eelspot', 26, 11); b.spawn('eelspot', 38, 11); b.spawn('eelspot', 54, 11);
        // castle
        b.solid(58, 112, 10, 12); b.solid(58, 60, 0, 6); b.gate(60, 7, 9, 1);
        b.solid(61, 112, 0, 1);
        b.chest('T', 63, 10);
        b.deco('banner', 66, 2); b.deco('banner', 78, 2); b.deco('banner', 96, 2); b.deco('window', 72, 9); b.deco('window', 90, 9); b.deco('window', 104, 9);
        b.deco('torch', 64, 7); b.deco('torch', 76, 7); b.deco('torch', 94, 7); b.deco('torch', 108, 7);
        b.ladder(65, 6, 9); b.plat(66, 80, 6); b.spawn('skeleton', 72, 6); b.spawn('skeleton', 78, 6);
        b.spawn('haunt', 74, 10);
        b.solid(81, 81, 9, 9); b.solid(82, 90, 7, 9); b.fill(84, 90, 8, 9, 0); b.fill(85, 87, 7, 7, 6); b.chest('m', 86, 10);
        b.spawn('gargoyle', 89, 7);
        b.check(96, 10);
        b.spawn('haunt', 102, 10); b.zone(92, 111, 'zombie', 120, 2, { v: 'zombie' });
        // second moat
        b.liquid(113, 150);
        b.fill(113, 120, 10, 10, 10);
        b.solid(121, 124, 9, 12); b.spawn('gargoyle', 123, 9);
        b.solid(127, 128, 10, 12); b.solid(131, 132, 9, 12); b.solid(135, 136, 10, 12); b.solid(139, 140, 9, 12);
        b.spawn('eelspot', 125, 11); b.spawn('eelspot', 130, 11); b.spawn('eelspot', 134, 11); b.spawn('eelspot', 138, 11); b.spawn('eelspot', 146, 11);
        b.fill(141, 150, 10, 10, 10);
        b.ground(151, 199, 10);
        b.deco('tree', 158, 10); b.deco('tree', 168, 10);
        b.zone(113, 177, 'bat', 150, 2);
        b.zone(151, 176, 'zombie', 110, 2, { v: 'zombie' });
        b.wind(0, 57); b.wind(113, 177);
        b.arena(178, 'dragon');
        b.liquid(184, 191); b.plat(186, 189, 9);
        b.solid(198, 199, 0, 12);
      },
    },
    {
      name: 'THE JAFFAR SPIKE CATACOMBS', sub: 'BENEATH THE SULTAN\'S PALACE', year: 'PRINCE OF PERSIA · 1989', boss: 'GRAND VIZIER JAFFAR', map: [160, 150], w: 190,
      build(b) {
        b.ground(0, 189); b.solid(0, 189, 0, 1);
        for (let x = 4; x < 186; x += 11) b.deco('torch', x, 7);
        for (let x = 9; x < 186; x += 22) b.deco('chain', x, 2);
        b.deco('sign', 5, 11, { text: '60 MINUTES LEFT' });
        b.spawn('slicer', 18, 11);
        b.fill(24, 26, 11, 11, 0); b.fill(24, 26, 12, 12, 4);
        b.spawn('skeleton', 30, 11);
        b.solid(34, 40, 7, 7); b.ladder(33, 7, 10); b.plate(38, 7, 2, 'potion');
        b.fill(41, 43, 7, 7, 10);
        b.spawn('swords', 46, 11);
        b.plate(50, 11, 3); b.plate(51, 11, 3); b.chest('T', 54, 11);
        b.solid(62, 62, 2, 7); b.gate(62, 8, 10, 3);
        b.deco('sign', 57, 11, { text: 'HEAVY ONLY' });
        b.solid(64, 65, 9, 10); b.fill(66, 71, 11, 11, 4); b.fill(66, 71, 8, 8, 10); b.fill(66, 72, 5, 5, 7); b.chest('t', 70, 5);
        b.spawn('slicer', 76, 11); b.spawn('slicer', 80, 11);
        b.check(84);
        b.solid(85, 85, 10, 10); b.solid(86, 86, 9, 10); b.solid(87, 100, 8, 10); b.fill(89, 100, 9, 10, 0); b.fill(90, 92, 8, 8, 6); b.chest('T', 91, 11);
        b.spawn('swords', 96, 8); b.spawn('swords', 99, 8);
        b.zone(60, 160, 'bat', 160, 2);
        b.fill(104, 105, 11, 11, 0); b.fill(104, 105, 12, 12, 4);
        b.spawn('slicer', 110, 11); b.spawn('slicer', 114, 11);
        b.plate(120, 11, 5, 'potion'); b.spawn('skeleton', 118, 11);
        b.spawn('haunt', 126, 11);
        b.plate(132, 11, 6); b.plate(133, 11, 6); b.chest('T', 135, 11);
        b.solid(142, 142, 2, 7); b.gate(142, 8, 10, 6);
        b.fill(148, 150, 11, 11, 0); b.fill(148, 150, 12, 12, 4);
        b.spawn('swords', 154, 11); b.spawn('slicer', 158, 11); b.spawn('skeleton', 163, 11);
        b.arena(168, 'jaffar');
        b.plat(171, 174, 7); b.plat(181, 184, 7);
        b.deco('pillar', 170, 11); b.deco('pillar', 177, 11); b.deco('pillar', 185, 11);
        b.solid(188, 189, 0, 12);
      },
    },
    {
      name: 'THE LEMMINGS CRUSHER FOUNDRY', sub: 'OH NO! MORE UNDEAD', year: 'LEMMINGS · 1991', boss: 'THE 10-TON CRUSHER ENGINE', map: [226, 96], w: 200,
      build(b) {
        b.ground(0, 199);
        b.deco('sign', 4, 11, { text: "LET'S GO!" });
        b.spawn('hatch', 9, 2); b.solid(0, 30, 0, 1);
        b.deco('pipe', 3, 11); b.deco('gear', 20, 6); b.deco('gear', 23, 7, { dir: -1 });
        b.fill(14, 22, 11, 11, 12);
        b.spawn('blocker', 26, 11);
        b.liquid(30, 32);
        b.solid(34, 50, 0, 1); b.spawn('piston', 38, 2, { ph: 0 }); b.spawn('piston', 42, 2, { ph: 40 }); b.spawn('piston', 46, 2, { ph: 80 });
        b.fill(52, 60, 11, 11, 11);
        b.spawn('skeleton', 56, 11);
        b.solid(58, 72, 0, 1); b.spawn('hatch', 62, 2);
        b.fill(70, 70, 2, 10, 6); b.spawn('blocker', 68, 11);
        b.deco('sign', 65, 11, { text: 'DIG!' });
        b.zone(0, 170, 'zombie', 140, 2, { v: 'trooper' });
        b.check(80);
        b.solid(82, 98, 0, 1); b.fill(84, 96, 11, 11, 12);
        b.spawn('piston', 86, 2, { ph: 0 }); b.spawn('piston', 90, 2, { ph: 30 }); b.spawn('piston', 94, 2, { ph: 60 });
        b.deco('gear', 99, 6);
        b.liquid(100, 110); b.plat(101, 102, 9); b.plat(105, 106, 8); b.plat(109, 110, 9);
        b.fill(100, 110, 5, 5, 7); b.solid(111, 114, 5, 5); b.chest('m', 113, 5);
        b.spawn('arremer', 118, 6);
        b.spawn('blocker', 122, 11); b.spawn('skeleton', 128, 11);
        b.solid(130, 146, 0, 1); b.fill(130, 146, 11, 11, 11);
        b.spawn('piston', 133, 2, { ph: 0 }); b.spawn('piston', 137, 2, { ph: 50 }); b.spawn('piston', 141, 2, { ph: 25 }); b.spawn('piston', 145, 2, { ph: 75 });
        b.chest('T', 150, 11);
        b.spawn('hatch', 156, 2); b.solid(152, 162, 0, 1);
        b.liquid(164, 165); b.spawn('blocker', 170, 11); b.spawn('haunt', 173, 11);
        for (let x = 5; x < 176; x += 17) b.deco('lamp', x, 3);
        b.arena(178, 'engine'); b.solid(178, 197, 0, 1);
        b.solid(198, 199, 0, 12);
      },
    },
    {
      name: 'PHOBOS E1M1 NECROPOLIS', sub: 'THE HANGAR OF THE DAMNED', year: 'DOOM · 1993', boss: 'THE ARREMER ACE', map: [264, 40], w: 200,
      build(b) {
        b.ground(0, 199);
        b.deco('sign', 4, 11, { text: 'E1M1: HANGAR' }); b.deco('panel', 8, 11); b.deco('panel', 10, 11);
        b.zone(0, 176, 'zombie', 120, 3, { v: 'trooper' });
        b.fill(14, 16, 11, 11, 13);
        b.spawn('barrel', 21, 11); b.spawn('barrel', 22, 11); b.spawn('imp', 26, 11);
        b.solid(30, 30, 10, 10); b.solid(31, 31, 9, 10); b.solid(32, 40, 8, 10); b.spawn('imp', 37, 8); b.deco('panel', 34, 8);
        b.fill(44, 53, 11, 11, 13); b.solid(46, 46, 9, 10); b.solid(49, 49, 9, 10); b.solid(52, 52, 9, 10);
        b.fill(44, 51, 6, 6, 7); b.solid(41, 42, 6, 6); b.chest('t', 42, 6);
        b.zone(30, 170, 'skull', 170, 2);
        b.ladder(60, 6, 10); b.plat(61, 75, 6); b.spawn('arremer', 70, 6); b.spawn('barrel', 64, 11); b.spawn('imp', 68, 11);
        for (let x = 56; x < 80; x += 6) b.deco('lamp', x, 6);
        b.check(80);
        b.deco('exit', 82, 8);
        b.fill(88, 90, 11, 11, 13);
        b.spawn('barrel', 94, 11); b.spawn('barrel', 95, 11); b.spawn('imp', 98, 11); b.spawn('imp', 104, 11);
        b.deco('panel', 108, 11); b.deco('panel', 111, 11);
        b.spawn('arremer', 115, 6);
        b.fill(120, 141, 11, 11, 13);
        b.solid(122, 124, 9, 9); b.solid(126, 128, 8, 8); b.solid(130, 132, 9, 9); b.solid(134, 136, 8, 8); b.solid(138, 140, 9, 9);
        b.fill(126, 136, 5, 5, 7); b.chest('m', 131, 5);
        b.spawn('arremer', 140, 5);
        b.chest('T', 146, 11);
        b.spawn('imp', 150, 11); b.spawn('barrel', 156, 11); b.spawn('haunt', 160, 11); b.spawn('imp', 166, 11); b.spawn('barrel', 171, 11);
        for (let x = 4; x < 176; x += 13) b.deco('lamp', x, 4);
        b.arena(178, 'ace');
        b.fill(186, 189, 11, 11, 13); b.plat(180, 183, 7); b.plat(192, 195, 7);
        b.solid(198, 199, 0, 12);
      },
    },
    {
      name: 'THRONE OF ASTAROTH-', sub: 'LECHUCK-9000', year: 'THE CURSED FLOPPY DISK', boss: 'ASTAROTH-LECHUCK-9000', map: [284, 132], w: 82,
      build(b) {
        b.ground(0, 81);
        b.deco('sign', 3, 11, { text: 'NO SAVE POINTS' });
        b.liquid(10, 11); b.liquid(22, 23);
        b.chest('T', 16, 11);
        b.solid(24, 25, 9, 10); b.fill(26, 32, 6, 6, 7); b.solid(33, 34, 6, 6); b.chest('m', 34, 6);
        b.spawn('skeleton', 14, 11); b.spawn('haunt', 20, 11); b.spawn('imp', 28, 11); b.spawn('arremer', 36, 5); b.spawn('swords', 40, 11);
        b.zone(0, 44, 'zombie', 110, 2, { v: 'zombie' });
        for (let x = 2; x < 60; x += 9) b.deco('torch', x, 7);
        b.check(46);
        b.chest('T', 52, 11);
        b.deco('throne', 56, 11);
        b.arena(60, 'final');
        b.plat(63, 66, 7); b.plat(73, 76, 7);
        b.solid(80, 81, 0, 12);
      },
    },
  ];

  const cache = {};
  function build(idx) {
    const def = LIST[idx], th = THEMES[idx];
    if (!cache[idx]) {
      cache[idx] = { sky: buildSky(th, idx), far: FAR[idx](), mid: MID[idx](), tiles: buildTileset(th) };
    }
    const b = Builder(def.w, th);
    def.build(b);
    const W = b.W;
    W.idx = idx; W.def = def; W.gfx = cache[idx];
    // per-tile material selector
    const mats = Object.keys(th.mats);
    W.matAt = idx === 0 ? ((tx, ty) => (W.rock && tx * 16 >= W.rock.x0 && tx * 16 < W.rock.x1) ? (ty === 9 ? 'wood' : 'hull') : 'earth') : () => mats[0];
    W.gateOpen = {}; for (const g in W.gates) W.gateOpen[g] = 0;
    return W;
  }

  function init() { buildDecos(); }
  return { THEMES, LIST, build, init, drawDeco, DECO, ROWS };
})();
window.Stages = Stages;
window.TILE = TILE;
