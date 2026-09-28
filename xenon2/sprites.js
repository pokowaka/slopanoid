'use strict';
/* =============================================================================
 *  XENON II · MEGABLAST — sprites.js
 *  Every sprite is "shaded" at boot from signed-distance functions through the
 *  GFX chrome/metal/organic shader — no bitmap assets. Enemy materials use the
 *  stage ramps (E0/E1) so each epoch recolours the same shapes automatically.
 * ===========================================================================*/
const SPR = {};
const Sprites = (() => {
  const { SDF, M, R, makeSprite: mk } = GFX;
  const { circle, ellipse, box, seg, poly, smin } = SDF;
  const frames = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
  const rot = (x, y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; };
  const MR = { b: R.FIRE, k: 'metal' }, MW = { b: R.CHROME, k: 'metal', o: 0.22 };
  const E0D = { b: R.E0, k: 'metal', o: -0.25 }, E1D = { b: R.E1, k: 'metal', o: -0.25 };

  function buildShip() {
    SPR.ship = mk(26, 30, (x, y) => {
      const body = ellipse(x, y, 13, 15, 4.2, 12.5);
      const wings = poly(x, y, [13, 10, 1.5, 22, 2.5, 25.5, 9, 22.5, 13, 23.5, 17, 22.5, 23.5, 25.5, 24.5, 22]);
      const nac = Math.min(ellipse(x, y, 8.5, 22.5, 2.2, 4.2), ellipse(x, y, 17.5, 22.5, 2.2, 4.2));
      return Math.min(smin(body, wings, 2.5), nac, seg(x, y, 13, 20, 13, 28, 1.2));
    }, (x, y) => {
      if (ellipse(x, y, 13, 10.5, 1.9, 3.4) < 0) return M.plasma;
      if (x < 5.5 || x > 20.5) return M.gold;
      if (y > 25.5 && Math.abs(x - 13) > 2) return M.firem;
      return M.chrome;
    }, { rad: 3, detail: (x, y) => ((y | 0) === 17 && Math.abs(x - 13) < 4) ? -0.3 : 0 });
    // --- NOSE hardpoints
    SPR.nose_pulse = mk(8, 8, (x, y) => circle(x, y, 4, 4, 2.8), (x, y) => circle(x, y, 4, 3.6, 1.4) < 0 ? M.plasma : M.chrome, { rad: 2 });
    SPR.nose_vulcan = mk(12, 12, (x, y) => Math.min(seg(x, y, 3.5, 1.5, 3.5, 8, 1.3), seg(x, y, 8.5, 1.5, 8.5, 8, 1.3), box(x, y, 6, 9, 4.5, 2, 1)),
      (x, y) => y < 3 ? M.dark : (y > 7 ? M.gold : M.chrome), { rad: 1.5 });
    SPR.nose_spread = mk(12, 12, (x, y) => circle(x, y, 6, 6, 5), (x, y) => {
      const d = Math.hypot(x - 6, y - 6); return d < 2.6 ? M.mag : (d < 3.4 ? M.dark : M.chrome);
    }, { rad: 2 });
    SPR.nose_arc = mk(14, 12, (x, y) => Math.min(seg(x, y, 4, 9, 1.8, 1.8, 1.1), seg(x, y, 10, 9, 12.2, 1.8, 1.1), box(x, y, 7, 9.5, 4.5, 2, 1), circle(x, y, 1.8, 1.8, 1.6), circle(x, y, 12.2, 1.8, 1.6)),
      (x, y) => (y < 3.5) ? M.plasma : (y > 7.5 ? M.gold : M.chrome), { rad: 1.5 });
    // --- WING pods
    SPR.pod_sidelaser = mk(8, 15, (x, y) => Math.min(seg(x, y, 4, 2.5, 4, 12.5, 2.6), box(x, y, 4, 8, 3.6, 1.2)), (x, y) => y < 4.5 ? M.fire : ((y | 0) === 8 ? M.gold : M.chrome), { rad: 2 });
    SPR.pod_missile = mk(9, 15, (x, y) => Math.min(seg(x, y, 2.6, 2, 2.6, 11, 1.4), seg(x, y, 6.4, 2, 6.4, 11, 1.4), box(x, y, 4.5, 11, 4, 3, 1)),
      (x, y) => y < 3.8 ? MR : (y > 8.5 ? M.steel : M.chrome), { rad: 1.5 });
    SPR.pod_bounce = mk(10, 14, (x, y) => Math.min(circle(x, y, 5, 5, 4.2), box(x, y, 5, 10.5, 2, 3, 1)), (x, y) => circle(x, y, 5, 4.2, 2.3) < 0 ? M.green : (y > 8 ? M.gold : M.chrome), { rad: 2.5 });
    // --- TAIL
    SPR.tail_tailgun = mk(12, 10, (x, y) => Math.min(seg(x, y, 3.5, 2, 3.5, 8.5, 1.3), seg(x, y, 8.5, 2, 8.5, 8.5, 1.3), box(x, y, 6, 2.5, 4.5, 2, 1)), (x, y) => y > 7 ? M.dark : (y < 4 ? M.gold : M.chrome), { rad: 1.5 });
    SPR.tail_mines = mk(12, 10, (x, y) => box(x, y, 6, 5, 4.5, 3.8, 2.2), (x, y) => (Math.abs(x - 6) < 2 && Math.abs(y - 5) < 1.8) ? M.plasma : M.chrome, { rad: 2 });
    // --- HULL overlays
    SPR.hull_plating = mk(26, 30, (x, y) => Math.min(box(x, y, 9.3, 16, 1.4, 5, 0.8), box(x, y, 16.7, 16, 1.4, 5, 0.8), seg(x, y, 7, 15, 3, 21, 1), seg(x, y, 19, 15, 23, 21, 1)), () => M.brass, { rad: 1.5 });
    SPR.hull_capacitor = mk(26, 30, (x, y) => Math.min(Math.abs(ellipse(x, y, 13, 18, 6.2, 1.7)) - 0.8, Math.abs(ellipse(x, y, 13, 21, 5.6, 1.5)) - 0.8), () => M.plasma, { rad: 1, outline: 0 });
    SPR.hull_afterburner = mk(26, 34, (x, y) => Math.min(ellipse(x, y, 8.5, 27, 2.8, 4), ellipse(x, y, 17.5, 27, 2.8, 4)), (x, y) => y > 29 ? M.firem : M.chrome, { rad: 2 });
    // --- drones
    SPR.drone = frames(8, f => mk(11, 11, (x, y) => circle(x, y, 5.5, 5.5, 4.4), (x, y) => {
      const a = f / 8 * Math.PI * 2; return circle(x, y, 5.5 + Math.cos(a) * 2, 5.2 + Math.sin(a) * 0.8, 1.4) < 0 ? M.fire : M.chrome;
    }, { rad: 3 }));
  }

  function buildItems() {
    SPR.bubble = mk(16, 16, (x, y) => circle(x, y, 8, 8, 7.2), (x, y) => {
      const d = Math.hypot(x - 8, y - 8);
      if (d < 4.2) return M.gold;
      if (d < 5.6) return (Math.hypot(x - 5.5, y - 5) < 1.6) ? { b: R.CHROME, k: 'flat', s: 1 } : null;
      return M.plasma;
    }, { rad: 2, outline: 0 });
    SPR.coin = mk(8, 8, (x, y) => circle(x, y, 4, 4, 3.2), () => M.gold, { rad: 2 });
    SPR.capsule = mk(14, 10, (x, y) => seg(x, y, 4, 5, 10, 5, 3.6), (x, y) => x < 7 ? M.fire : M.plasma, { rad: 2.5 });
  }

  function buildEnemies() {
    // ===== STAGE 1: CAMBRIAN
    SPR.trilobite = frames(2, f => mk(16, 21, (x, y) => {
      let d = smin(ellipse(x, y, 8, 9, 6, 8), ellipse(x, y, 8, 15, 7.5, 4.5), 2);
      d = Math.min(d, ellipse(x, y, 8, 2.5, 3, 2), seg(x, y, 2, 15, 0.8 + f * 0.4, 19.8, 0.8), seg(x, y, 14, 15, 15.2 - f * 0.4, 19.8, 0.8));
      return d;
    }, (x, y) => (circle(x, y, 5, 14.5, 1.1) < 0 || circle(x, y, 11, 14.5, 1.1) < 0) ? M.e1c : M.e0, {
      rad: 3, detail: (x, y) => { const ax = Math.abs(x - 8); let o = 0; if (y < 12 && (y | 0) % 2 === 0) o -= 0.18; if (ax < 1.8) o += 0.12; else if (ax < 2.6) o -= 0.18; return o; },
    }));
    SPR.ammonite = frames(8, f => mk(19, 19, (x, y) => circle(x, y, 9.5, 9.5, 8.5), () => M.e1, {
      rad: 5, detail: (x, y) => {
        const dx = x - 9.5, dy = y - 9.5, r = Math.hypot(dx, dy) + 0.01, th = Math.atan2(dy, dx) + f / 8 * Math.PI * 2;
        const sp = ((Math.log(r + 1) * 1.6 - th / (Math.PI * 2)) % 1 + 1) % 1;
        let o = sp < 0.12 ? -0.4 : 0; if (Math.sin(th * 14) > 0.6) o -= 0.12; return o;
      },
    }));
    SPR.coralturret = mk(15, 14, (x, y) => smin(circle(x, y, 7.5, 8, 6), ellipse(x, y, 7.5, 11, 7, 3), 2), (x, y) => circle(x, y, 7.5, 7.5, 2.2) < 0 ? M.mag : M.e0o, {
      rad: 3, detail: (x, y) => Math.sin(x * 1.7) * Math.sin(y * 1.9) * 0.18,
    });
    SPR.eurypterid = mk(30, 38, (x, y) => {
      let d = smin(ellipse(x, y, 15, 18, 7.5, 12), ellipse(x, y, 15, 28, 9, 6), 3);
      d = Math.min(d, seg(x, y, 15, 7, 15, 1, 1.6), ellipse(x, y, 5, 22, 4, 2.4), ellipse(x, y, 25, 22, 4, 2.4));
      d = Math.min(d, seg(x, y, 10, 31, 6, 36, 1.5), seg(x, y, 20, 31, 24, 36, 1.5));
      return d;
    }, (x, y) => (circle(x, y, 11, 29, 1.5) < 0 || circle(x, y, 19, 29, 1.5) < 0) ? M.fire : M.e0, {
      rad: 4, detail: (x, y) => (y > 8 && y < 24 && (y | 0) % 3 === 0) ? -0.22 : 0,
    });
    // ===== STAGE 2: ABYSSAL
    SPR.squid = frames(2, f => mk(15, 23, (x, y) => {
      let d = smin(ellipse(x, y, 7.5, 7, 5, 7), ellipse(x, y, 7.5, 14, 3.5, 2.5), 2);
      d = Math.min(d, poly(x, y, [2.5, 3, 7.5, -1, 12.5, 3, 7.5, 5]));
      const sp = f ? 1.5 : 0;
      for (const [a, b] of [[4.5, 2.5 - sp], [6.5, 5.5], [8.5, 9.5], [10.5, 12.5 + sp]]) d = Math.min(d, seg(x, y, a, 15, b, 22, 0.9));
      return d;
    }, (x, y) => ((circle(x, y, 5.5, 6, 1) < 0) || (circle(x, y, 9.5, 8, 1) < 0) || (circle(x, y, 7.5, 3.5, 0.9) < 0)) ? M.plasma : M.e0o, { rad: 3 }));
    SPR.nautilus = frames(8, f => mk(21, 21, (x, y) => smin(circle(x, y, 10.5, 9, 8.5), ellipse(x, y, 10.5, 16, 5.5, 3.5), 2), (x, y) => {
      if (circle(x, y, 10.5, 16.5, 1.4) < 0) return M.fire;
      if (y > 14) return M.e0o;
      const th = Math.atan2(y - 9, x - 10.5) + f / 8 * Math.PI * 2;
      return Math.sin(th * 5) > 0.2 ? E1D : M.e1;
    }, { rad: 5 }));
    SPR.mine = mk(13, 13, (x, y) => {
      let d = circle(x, y, 6.5, 6.5, 3.8);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; d = Math.min(d, seg(x, y, 6.5, 6.5, 6.5 + Math.cos(a) * 5.8, 6.5 + Math.sin(a) * 5.8, 0.7)); }
      return d;
    }, () => M.chrome, { rad: 2 });
    SPR.vent = mk(17, 13, (x, y) => ellipse(x, y, 8.5, 7, 7.5, 5), (x, y) => ellipse(x, y, 8.5, 6.2, 3.5, 2) < 0 ? M.fire : M.e0o, { rad: 3 });
    SPR.angler = mk(24, 22, (x, y) => Math.min(ellipse(x, y, 12, 12, 9.5, 7.5), seg(x, y, 12, 5, 17, 1.8, 0.7), circle(x, y, 18.5, 2, 1.8), poly(x, y, [3, 10, 0.5, 5, 0.5, 15])), (x, y) => {
      if (circle(x, y, 18.5, 2, 1.8) < 0) return M.plasma;
      if (circle(x, y, 8, 10, 1.4) < 0 || circle(x, y, 16, 10, 1.4) < 0) return M.fire;
      if (y > 15 && Math.abs(x - 12) < 7 && ((x | 0) % 2 === 0)) return MW;
      return M.e0o;
    }, { rad: 4 });
    // ===== STAGE 3: CLOCKWORK
    SPR.gear = frames(4, f => mk(17, 17, (x, y) => {
      const dx = x - 8.5, dy = y - 8.5, th = Math.atan2(dy, dx) + f / 4 * (Math.PI * 2 / 8);
      const ro = 6 + 1.6 * Math.max(-1, Math.min(1, Math.cos(th * 8) * 3));
      return Math.max(Math.hypot(dx, dy) - ro, -(Math.hypot(dx, dy) - 1.8));
    }, (x, y) => Math.hypot(x - 8.5, y - 8.5) < 3.4 ? M.steel : M.e0, { rad: 2 }));
    SPR.beetle = mk(15, 18, (x, y) => Math.min(ellipse(x, y, 7.5, 9, 5.5, 6.5), ellipse(x, y, 7.5, 15, 3, 2.2), circle(x, y, 4.8, 2, 1.5), circle(x, y, 10.2, 2, 1.5), seg(x, y, 7.5, 2, 7.5, 4, 0.8)),
      (x, y) => y < 4 ? M.gold : (circle(x, y, 6, 15.5, 0.9) < 0 || circle(x, y, 9, 15.5, 0.9) < 0) ? M.fire : M.e1, { rad: 3, detail: (x) => Math.abs(x - 7.5) < 0.6 ? -0.35 : 0 });
    SPR.tesla = mk(13, 17, (x, y) => Math.min(box(x, y, 6.5, 14, 5, 2.5, 1), seg(x, y, 6.5, 12, 6.5, 6, 1.9), circle(x, y, 6.5, 4, 3.2)),
      (x, y) => y < 7 ? M.chrome : (y > 11.5 ? M.e0 : M.e1), { rad: 2, detail: (x, y) => (y > 6 && y < 12 && (y | 0) % 2) ? -0.3 : 0 });
    SPR.brassturret = mk(15, 15, (x, y) => circle(x, y, 7.5, 7.5, 6.5), (x, y) => circle(x, y, 7.5, 7.5, 2) < 0 ? M.black : M.gold, {
      rad: 4, detail: (x, y) => { const a = Math.atan2(y - 7.5, x - 7.5), r = Math.hypot(x - 7.5, y - 7.5); return (r > 4.5 && r < 5.6 && Math.cos(a * 6) > 0.8) ? 0.4 : 0; },
    });
    SPR.automaton = mk(30, 30, (x, y) => Math.min(box(x, y, 15, 15, 11, 10, 3), seg(x, y, 3.5, 17, 3.5, 27, 2.2), seg(x, y, 26.5, 17, 26.5, 27, 2.2), circle(x, y, 7, 5, 3.5), circle(x, y, 23, 5, 3.5)), (x, y) => {
      const r = Math.hypot(x - 15, y - 15);
      if (r < 5.5) return (Math.abs(x - 15) < 0.7 && y < 15) || (Math.abs(y - 15) < 0.7 && x > 15) ? M.black : M.chrome;
      if (y > 25 && (x < 6 || x > 24)) return M.dark;
      return M.e0;
    }, { rad: 3, detail: (x, y) => ((x | 0) % 6 === 2 && (y | 0) % 6 === 2) ? 0.35 : 0 });
    SPR.piston = mk(64, 10, (x, y) => Math.min(box(x, y, 26, 5, 26, 2.2, 1), box(x, y, 58, 5, 5, 4.5, 1.5)), (x) => x > 52 ? M.brass : M.chrome, { rad: 2 });
    // ===== STAGE 4: SILICON 1989
    SPR.chip = mk(17, 15, (x, y) => {
      let d = box(x, y, 8.5, 7.5, 6, 5, 0.8);
      for (let i = 0; i < 4; i++) { d = Math.min(d, box(x, y, 4 + i * 3, 1.2, 0.7, 1.3), box(x, y, 4 + i * 3, 13.8, 0.7, 1.3)); }
      return d;
    }, (x, y) => (y < 2.5 || y > 12.5) ? M.gold : (Math.abs(x - 8.5) < 1.6 && Math.abs(y - 7.5) < 1.4 ? M.plasma : M.dark), { rad: 1.5 });
    SPR.copperdiver = mk(19, 15, (x, y) => poly(x, y, [9.5, 14, 1, 2, 9.5, 5.5, 18, 2]), (x, y) => circle(x, y, 9.5, 8.5, 1.8) < 0 ? M.plasma : M.e1c, { rad: 2.5 });
    SPR.boing = frames(8, f => mk(28, 28, (x, y) => circle(x, y, 14, 14, 12.8), (x, y) => {
      const dx = (x - 14) / 12.8, dy = (y - 14) / 12.8, d2 = dx * dx + dy * dy; if (d2 >= 1) return MW;
      const nz = Math.sqrt(1 - d2), c = Math.cos(0.35), s = Math.sin(0.35), X = dx * c - dy * s, Y = dx * s + dy * c;
      const lon = Math.atan2(X, nz) + f / 8 * (Math.PI / 4), lat = Math.asin(Math.max(-1, Math.min(1, Y)));
      return ((Math.floor(lon / (Math.PI / 8) + 32) + Math.floor(lat / (Math.PI / 8) + 32)) & 1) ? MR : MW;
    }, { rad: 13 }));
    // ===== STAGE 5: XENITE HIVE
    SPR.spore = frames(2, f => mk(9, 9, (x, y) => circle(x, y, 4.5, 4.5, 3.4 + f * 0.5), (x, y) => circle(x, y, 4.5, 4.5, 1.6) < 0 ? M.green : M.e1o, { rad: 2 }));
    SPR.hugger = frames(2, f => mk(17, 17, (x, y) => {
      let d = Math.min(ellipse(x, y, 8.5, 9, 3.8, 5), seg(x, y, 8.5, 4, 8.5, 0.5, 1));
      for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) {
        const bx = 8.5 + sd * 3, by = 6 + k * 2, ex = 8.5 + sd * (7.5 - (k === 0 ? 1 : 0)), ey = 3 + k * 3.8 + (f ? sd * 0.8 : -sd * 0.8);
        d = Math.min(d, seg(x, y, bx, by, ex, ey, 0.75));
      }
      return d;
    }, () => M.e0c, { rad: 2 }));
    SPR.wasp = frames(2, f => mk(17, 19, (x, y) => {
      const body = Math.min(ellipse(x, y, 8.5, 9, 3, 3.5), ellipse(x, y, 8.5, 3.8, 2.8, 3.8), ellipse(x, y, 8.5, 14.5, 2.6, 2.6));
      const wy = f ? 7 : 9;
      return Math.min(body, ellipse(x, y, 3.8, wy, 3.6, 1.7), ellipse(x, y, 13.2, wy, 3.6, 1.7));
    }, (x, y) => {
      if (Math.abs(x - 8.5) > 3.2) return (GFX.BAYER[((y | 0) & 3) * 4 + ((x | 0) & 3)] < 0.5) ? M.plasma : null;
      if (circle(x, y, 7.3, 15.3, 0.9) < 0 || circle(x, y, 9.7, 15.3, 0.9) < 0) return M.fire;
      if (y < 7.5) return ((y | 0) % 2) ? M.e1 : M.e0;
      return M.e0c;
    }, { rad: 2 }));
    SPR.gatenode = mk(13, 13, (x, y) => box(x, y, 6.5, 6.5, 5.5, 5.5, 2.2), (x, y) => circle(x, y, 6.5, 6.5, 2.3) < 0 ? M.fire : M.chrome, { rad: 2.5 });
    SPR.pod = mk(17, 15, (x, y) => ellipse(x, y, 8.5, 8, 7.5, 6), (x, y) => ellipse(x, y, 8.5, 6.5, 2.6, 1.6) < 0 ? M.green : M.e1o, {
      rad: 4, detail: (x, y) => Math.abs(Math.sin(x * 0.9 + Math.sin(y * 0.8) * 2)) < 0.15 ? -0.3 : 0,
    });
    SPR.warrior = mk(30, 34, (x, y) => {
      let d = Math.min(ellipse(x, y, 15, 25, 6, 8.5), ellipse(x, y, 15, 12, 9, 8));
      d = Math.min(d, seg(x, y, 6, 14, 2.5, 27, 1.8), seg(x, y, 24, 14, 27.5, 27, 1.8), seg(x, y, 15, 4, 15, 0.8, 1.6));
      return d;
    }, (x, y) => (y > 29 && Math.abs(x - 15) < 2.5) ? M.fire : (y < 20 ? M.e0 : M.e0c), {
      rad: 4, detail: (x, y) => (y > 5 && y < 19 && Math.abs(Math.sin(y * 1.3)) < 0.25) ? -0.35 : 0,
    });
  }

  // ================================================================ BOSSES
  function buildBosses() {
    // 1: Leviathan Anomalocaris
    SPR.boss1 = frames(4, f => mk(100, 76, (x, y) => {
      let d = ellipse(x, y, 50, 36, 11, 22);
      d = smin(d, ellipse(x, y, 50, 57, 13, 9), 4);
      for (let k = 0; k < 7; k++) {
        const yk = 16 + k * 6, sw = Math.sin(f / 4 * Math.PI * 2 + k * 0.9) * 2.5;
        d = Math.min(d, ellipse(x, y, 50 - 17 - sw, yk + sw * 0.3, 10, 3.2), ellipse(x, y, 50 + 17 + sw, yk + sw * 0.3, 10, 3.2));
      }
      d = Math.min(d, poly(x, y, [50, 16, 37, 2, 50, 7, 63, 2]));
      d = Math.min(d, seg(x, y, 42, 58, 32, 63, 1.6), circle(x, y, 30, 64, 3.4), seg(x, y, 58, 58, 68, 63, 1.6), circle(x, y, 70, 64, 3.4));
      const cl = f % 2 ? 1.5 : 0;
      d = Math.min(d, seg(x, y, 45, 64, 38 - cl, 72, 2.2), seg(x, y, 38 - cl, 72, 34 - cl, 67, 1.6), seg(x, y, 55, 64, 62 + cl, 72, 2.2), seg(x, y, 62 + cl, 72, 66 + cl, 67, 1.6));
      return d;
    }, (x, y) => {
      if (circle(x, y, 30, 64, 3.4) < 0 || circle(x, y, 70, 64, 3.4) < 0) return M.fire;
      if (circle(x, y, 50, 63, 4) < 0) return M.mag;
      if (y > 66) return M.e1;
      return M.e0;
    }, { rad: 5, detail: (x, y) => (y > 14 && y < 52 && Math.abs(x - 50) < 10 && (y | 0) % 6 === 0) ? -0.3 : 0 }));
    // 2: Kraken-Nautilus (tentacles drawn at runtime)
    SPR.boss2 = frames(4, f => mk(100, 66, (x, y) => smin(circle(x, y, 50, 28, 26), ellipse(x, y, 50, 47, 21, 11), 5), (x, y) => {
      if (circle(x, y, 50, 46, 5.5) < 0) return M.fire;
      if (y > 40) return M.e0o;
      const th = Math.atan2(y - 28, x - 50) + f / 4 * 0.4, r = Math.hypot(x - 50, y - 28);
      return (Math.sin(th * 7 + r * 0.08) > 0.25) ? E1D : M.e1;
    }, {
      rad: 9, detail: (x, y) => {
        const r = Math.hypot(x - 50, y - 28), th = Math.atan2(y - 28, x - 50);
        const sp = ((Math.log(r + 1) * 1.3 - th / (Math.PI * 2)) % 1 + 1) % 1; return (y < 42 && sp < 0.06) ? -0.4 : 0;
      },
    }));
    // 3: Difference Engine Automaton
    SPR.boss3 = frames(4, f => mk(116, 76, (x, y) => {
      let d = box(x, y, 58, 36, 44, 24, 3);
      d = Math.min(d, box(x, y, 58, 8, 7, 7, 2), circle(x, y, 58, 4, 5));
      d = Math.min(d, seg(x, y, 7, 64, 7, 22, 3), circle(x, y, 7, 17, 5.5), seg(x, y, 109, 64, 109, 22, 3), circle(x, y, 109, 17, 5.5));
      d = Math.min(d, circle(x, y, 58, 64, 7.5), box(x, y, 58, 70, 30, 3.5, 1.5));
      return d;
    }, (x, y) => {
      if (circle(x, y, 58, 64, 5) < 0) return M.plasma;
      if (circle(x, y, 7, 17, 5.5) < 0 || circle(x, y, 109, 17, 5.5) < 0 || circle(x, y, 58, 4, 5) < 0) return M.chrome;
      if (x < 10.5 || x > 105.5) return M.e1;
      for (let k = 0; k < 7; k++) { const cx = 25 + k * 11; if (Math.abs(x - cx) < 3.6 && Math.abs(y - 34) < 16) return ((Math.floor(y + f * 2) % 4) === 0) ? M.black : M.steel; }
      return M.brass;
    }, { rad: 4, detail: (x, y) => ((x | 0) % 8 === 4 && ((y | 0) === 14 || (y | 0) === 56)) ? 0.4 : 0 }));
    // 4: 68000 Cyber-Blitter
    SPR.boss4 = frames(2, f => mk(116, 66, (x, y) => {
      let d = box(x, y, 58, 33, 48, 21, 2);
      for (let i = 0; i < 16; i++) {
        const px = 16 + i * 5.6, up = ((i + f) % 2) ? 1.2 : 0;
        d = Math.min(d, box(x, y, px, 7 - up, 1.6, 4), box(x, y, px, 59 + up, 1.6, 4));
      }
      return d;
    }, (x, y) => {
      if (y < 12 || y > 54) return M.gold;
      if (Math.abs(x - 58) < 10 && Math.abs(y - 33) < 7) return (Math.abs(x - 58) < 8 && Math.abs(y - 33) < 5) ? M.plasma : M.gold;
      return M.dark;
    }, { rad: 3 }));
    // 5: Sovereign Xenite Mother-Brain
    SPR.boss5 = frames(4, f => mk(124, 84, (x, y) => {
      const pul = Math.sin(f / 4 * Math.PI * 2) * 1.2;
      let d = ellipse(x, y, 62, 34, 30 + pul, 22 + pul);
      d = Math.min(d, circle(x, y, 62, 52, 9));
      for (let k = 0; k < 4; k++) {
        const rx = 46 - k * 3, ry = 34 - k * 4, ring = Math.abs(ellipse(x, y, 62, 40, rx + 6, ry + 6)) - 1.6;
        if (Math.abs(x - 62) > 26) d = Math.min(d, ring);
      }
      d = Math.min(d, seg(x, y, 62, 0, 62, 13, 4), seg(x, y, 14, 8, 36, 26, 2.6), seg(x, y, 110, 8, 88, 26, 2.6));
      d = Math.min(d, seg(x, y, 44, 60, 36, 78, 2.4), seg(x, y, 80, 60, 88, 78, 2.4));
      return d;
    }, (x, y) => {
      if (circle(x, y, 62, 52, 6.5) < 0) return circle(x, y, 62, 53, 2.6) < 0 ? M.black : M.fire;
      if (circle(x, y, 62, 52, 9) < 0) return M.e1o;
      if (ellipse(x, y, 62, 34, 31, 23) < 0) return M.e1o;
      return M.chrome;
    }, { rad: 6, grad: 0.6, detail: (x, y) => (ellipse(x, y, 62, 34, 31, 23) < 0 && Math.abs(Math.sin(x * 0.45 + Math.sin(y * 0.35) * 2.2)) < 0.22) ? -0.3 : 0 }));
  }

  // ================================================================ CRISPIN
  function buildCrispin() {
    const cr = {};
    cr.head = mk(112, 92, (x, y) => {
      let d = smin(ellipse(x, y, 56, 38, 33, 30), ellipse(x, y, 56, 60, 24, 17), 8);
      d = Math.min(d, poly(x, y, [26, 34, 8, 22, 16, 48]), poly(x, y, [86, 34, 104, 22, 96, 48]));
      return d;
    }, () => M.skin, {
      rad: 10, detail: (x, y) => {
        let o = 0; if (y < 30 && Math.abs(Math.sin(x * 0.35 + y * 0.12)) < 0.12) o -= 0.18;
        if (circle(x, y, 51, 64, 1.6) < 0 || circle(x, y, 61, 64, 1.6) < 0) o -= 0.5;
        return o;
      },
    });
    cr.jaw = mk(48, 20, (x, y) => ellipse(x, y, 24, 7, 19, 9), () => M.skin, { rad: 5, detail: (x, y) => y < 3 ? -0.2 : 0 });
    cr.glasses = mk(80, 22, (x, y) => Math.min(box(x, y, 22, 11, 15, 8, 5), box(x, y, 58, 11, 15, 8, 5), seg(x, y, 34, 9, 46, 9, 1.6), seg(x, y, 7, 8, 0.5, 6, 1.4), seg(x, y, 73, 8, 79.5, 6, 1.4)),
      (x, y) => (box(x, y, 22, 11, 13, 6.2, 4) < 0 || box(x, y, 58, 11, 13, 6.2, 4) < 0) ? M.dark : M.gold, { rad: 2.5, grad: 1.4 });
    cr.band = mk(112, 50, (x, y) => Math.max(Math.abs(ellipse(x, y, 56, 44, 42, 40)) - 2.6, y - 42), () => M.chrome, { rad: 2 });
    cr.cup = mk(16, 26, (x, y) => ellipse(x, y, 8, 13, 7, 12), (x, y) => ellipse(x, y, 8, 13, 3, 5) < 0 ? M.mag : M.chrome, { rad: 4 });
    cr.body = mk(112, 34, (x, y) => poly(x, y, [4, 34, 24, 6, 40, 2, 72, 2, 88, 6, 108, 34]), (x, y) => (Math.abs(x - 56) < 9 && y < 22) ? M.steel : M.magm, {
      rad: 5, detail: (x, y) => { const cx = 56 + Math.sin(y * 0.2) * 0; const onChain = Math.abs(Math.hypot(x - 56, y + 18) - 34) < 1.2 && y > 4; return onChain ? 0.9 : (Math.abs(x - cx) < 0.6 ? -0.3 : 0); },
    });
    SPR.crispin = cr;
  }

  function build() { buildShip(); buildItems(); buildEnemies(); buildBosses(); buildCrispin(); }
  return { build };
})();
