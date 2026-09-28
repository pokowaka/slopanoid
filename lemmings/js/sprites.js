/* ==========================================================================
 * LEMMINGS: BEAT TRIBE — sprites.js
 * Procedurally painted 10px lemmings (green hair, blue robe) — every frame
 * of every animation is composed in code from a tiny parametric body.
 * Sprite = list of [dx, dy, colour], origin at the ground pixel under the
 * feet, facing right (render mirrors dx for left-walkers).
 * ========================================================================== */
(function (G) {
  'use strict';
  const BT = G.BT;
  const C = BT.hexc;
  const P = (BT.PAL = {
    H: C(0x38e038), H2: C(0x16a024), S: C(0xf4c098), B: C(0x3a52f0), B2: C(0x7088ff), BD: C(0x1c2890),
    T: C(0xd0d0dc), TB: C(0x9a6630), K: C(0xd8a860), W: C(0xffffff), R: C(0xff3040), Y: C(0xffe040),
    O: C(0xff8a20), ASH: C(0x707070), ASH2: C(0x404040), BLACK: C(0x000000),
  });

  function body(o) {
    o = o || {};
    const hy = o.hy || 0, hx = o.hx || 0, bx = o.bx || 0, by = o.by || 0;
    const px = [];
    const add = (x, y, c) => px.push([x, y, c]);
    // head
    add(-1 + hx, -10 + hy + by, P.H); add(0 + hx, -10 + hy + by, P.H);
    add(-2 + hx, -9 + hy + by, P.H); add(-1 + hx, -9 + hy + by, P.H); add(0 + hx, -9 + hy + by, P.H2); add(1 + hx, -9 + hy + by, P.S);
    add(-1 + hx, -8 + hy + by, P.H2); add(0 + hx, -8 + hy + by, P.S); add(1 + hx, -8 + hy + by, P.S);
    if (!o.noBody) {
      add(-1 + bx, -7 + by, P.B); add(0 + bx, -7 + by, P.B);
      add(-1 + bx, -6 + by, P.B); add(0 + bx, -6 + by, P.B2); add(1 + bx, -6 + by, P.B);
      add(-1 + bx, -5 + by, P.B); add(0 + bx, -5 + by, P.B2); add(1 + bx, -5 + by, P.B);
      add(-1 + bx, -4 + by, P.B); add(0 + bx, -4 + by, P.B); add(1 + bx, -4 + by, P.B);
    }
    const legs = o.legs || 'stand';
    const L = {
      stand: [[-1, -3, P.B], [0, -3, P.B], [-1, -2, P.B], [0, -2, P.B], [-1, -1, P.BD], [0, -1, P.BD]],
      mid: [[-1, -3, P.B], [0, -3, P.B], [-1, -2, P.B], [0, -2, P.B], [-1, -1, P.BD], [1, -1, P.BD]],
      stride: [[-1, -3, P.B], [0, -3, P.B], [-2, -2, P.B], [1, -2, P.B], [-2, -1, P.BD], [2, -1, P.BD]],
      stride2: [[-1, -3, P.B], [0, -3, P.B], [-1, -2, P.B], [1, -2, P.B], [-3, -1, P.BD], [1, -1, P.BD]],
      kneel: [[-1, -3, P.B], [0, -3, P.B], [1, -2, P.B], [-1, -2, P.B], [-1, -1, P.BD], [2, -1, P.BD]],
      tuck: [[-1, -3, P.B], [1, -3, P.B], [-2, -2, P.BD], [2, -2, P.BD]],
      dangle: [[-1, -3, P.B], [0, -3, P.B], [-1, -2, P.BD], [1, -2, P.BD]],
      climb: [[-1, -3, P.B], [0, -3, P.B], [0, -2, P.B], [0, -1, P.BD]],
      climb2: [[-1, -3, P.B], [0, -3, P.B], [-1, -2, P.B], [0, -1, P.BD]],
      none: [],
    }[legs];
    for (const l of L) add(l[0] + bx, l[1] + by, l[2]);
    if (o.hands) for (const h of o.hands) add(h[0] + bx, h[1] + by, h[2] || P.S);
    if (o.extra) for (const e of o.extra) add(e[0], e[1], e[2]);
    if (o.dy) for (const p of px) p[1] += o.dy;
    if (o.cut !== undefined) return px.filter((p) => p[1] < o.cut);
    return px;
  }

  const S = (BT.SPR = {});
  // WALK: 8 frames; strike frames 0 & 4 dip the head (on the beat).
  S.walk = [
    body({ legs: 'stride', hy: 1, hands: [[2, -5]] }),
    body({ legs: 'mid', hands: [[1, -5]] }),
    body({ legs: 'stand', hands: [[1, -4]] }),
    body({ legs: 'mid', hands: [[0, -4], [-2, -5]] }),
    body({ legs: 'stride2', hy: 1, hands: [[-2, -5]] }),
    body({ legs: 'mid', hands: [[-2, -5]] }),
    body({ legs: 'stand', hands: [[1, -4]] }),
    body({ legs: 'mid', hands: [[2, -5]] }),
  ];
  S.fall = [
    body({ legs: 'dangle', hands: [[-2, -9], [2, -10]] }),
    body({ legs: 'dangle', hands: [[-2, -10], [2, -9]] }),
  ];
  const umbrella = (sway, open) => {
    const e = [];
    const cols = [P.R, P.W];
    if (open >= 1) {
      const rows = open >= 2 ? [[-16, 2], [-15, 3], [-14, 4]] : [[-15, 1], [-14, 2]];
      for (const [y, w] of rows) for (let x = -w; x <= w; x++) e.push([x + sway, y, cols[((x + 8) >> 1) & 1]]);
    }
    e.push([sway >> 1, -13, P.T], [0, -12, P.T], [0, -11, P.T]);
    return e;
  };
  S.float = [
    body({ legs: 'dangle', hands: [[0, -11], [1, -11]], extra: umbrella(0, 1) }),
    body({ legs: 'dangle', hands: [[0, -11], [1, -11]], extra: umbrella(0, 2) }),
    body({ legs: 'dangle', hands: [[0, -11], [1, -11]], extra: umbrella(1, 2) }),
    body({ legs: 'dangle', hands: [[0, -11], [1, -11]], extra: umbrella(0, 2) }),
    body({ legs: 'dangle', hands: [[0, -11], [1, -11]], extra: umbrella(-1, 2) }),
  ];
  S.climb = [
    body({ legs: 'climb', bx: -1, hx: -1, hands: [[1, -10], [1, -7]] }),
    body({ legs: 'climb2', bx: -1, hx: -1, hands: [[1, -9], [1, -6]] }),
    body({ legs: 'climb', bx: -1, hx: -1, hands: [[1, -11], [1, -8]] }),
    body({ legs: 'climb2', bx: -1, hx: -1, hands: [[1, -9], [1, -7]] }),
  ];
  S.hoist = [
    body({ legs: 'climb', bx: -1, hx: -1, hands: [[1, -11], [2, -11]], dy: -1 }),
    body({ legs: 'tuck', hands: [[2, -10], [2, -9]], dy: -3 }),
    body({ legs: 'kneel', hands: [[2, -7]], dy: -4 }),
    body({ legs: 'kneel', hands: [[2, -6]], dy: -2 }),
  ];
  S.build = [
    body({ legs: 'kneel', hy: 1, hands: [[2, -5], [3, -5, P.K], [4, -5, P.K]] }),
    body({ legs: 'kneel', hy: 1, hands: [[2, -3], [3, -3, P.K], [4, -3, P.K]] }),
    body({ legs: 'kneel', hy: 1, hands: [[2, -2], [3, -1, P.K], [4, -1, P.K]] }),
    body({ legs: 'stand', hands: [[1, -5]] }),
  ];
  S.shrug = [
    body({ legs: 'stand', hands: [[-2, -8], [2, -8]] }),
    body({ legs: 'stand', hy: 1, hands: [[-2, -9], [2, -9]] }),
  ];
  S.bash = [
    body({ legs: 'stride', hands: [[0, -5]] }),
    body({ legs: 'stride', hands: [[1, -6], [2, -6]] }),
    body({ legs: 'stride', hx: 1, hands: [[2, -5], [3, -5], [4, -5], [5, -6, P.Y]] }),
    body({ legs: 'stride', hands: [[2, -4], [3, -3]] }),
  ];
  S.mine = [
    body({ legs: 'stride', hands: [[-1, -10], [-2, -11, P.T], [-3, -12, P.T], [-1, -11, P.TB]] }),
    body({ legs: 'stride', hands: [[1, -9], [1, -10, P.TB], [2, -11, P.T], [3, -11, P.T]] }),
    body({ legs: 'stride', hy: 1, hands: [[2, -6], [3, -5, P.TB], [4, -4, P.T], [5, -3, P.T]] }),
    body({ legs: 'stride', hy: 1, hands: [[2, -4], [3, -3, P.TB], [4, -1, P.T], [5, -1, P.T], [6, -2, P.Y]] }),
  ];
  S.dig = [
    body({ legs: 'stride', hy: 1, hx: 1, hands: [[1, -3], [2, -2]] }),
    body({ legs: 'stride', hy: 2, hx: 1, hands: [[1, -1], [2, -1]] }),
    body({ legs: 'stride', hands: [[1, -7], [2, -8, P.K], [-1, -9, P.K]] }),
    body({ legs: 'stride', hy: 1, hands: [[1, -5], [3, -11, P.K]] }),
  ];
  S.block = [
    body({ legs: 'mid', hands: [[-2, -6, P.B], [-3, -6], [2, -6, P.B], [3, -6]] }),
    body({ legs: 'mid', hands: [[-2, -6, P.B], [-3, -7], [2, -6, P.B], [3, -7]] }),
  ];
  S.ohno = [
    body({ legs: 'stand', hands: [[-2, -10], [2, -10]] }),
    body({ legs: 'stand', bx: 1, hx: 1, hands: [[-2, -10], [2, -10]] }),
  ];
  S.splat = [
    body({ legs: 'none', noBody: false, dy: 2, cut: 0 }),
    [[-2, -3, P.H], [-1, -3, P.H], [0, -3, P.S], [1, -3, P.S], [-3, -2, P.B], [-2, -2, P.B], [-1, -2, P.B2], [0, -2, P.B], [1, -2, P.B], [2, -2, P.B], [-3, -1, P.BD], [3, -1, P.BD], [-2, -1, P.B], [2, -1, P.B]],
    [[-3, -2, P.H], [-2, -2, P.H], [-1, -2, P.S], [0, -2, P.B], [1, -2, P.B], [2, -2, P.B], [-4, -1, P.B], [-3, -1, P.B], [-2, -1, P.B2], [-1, -1, P.B], [0, -1, P.B], [1, -1, P.B], [3, -1, P.BD], [4, -1, P.BD]],
    [[-5, -1, P.B], [-4, -1, P.H], [-3, -1, P.B], [-2, -1, P.B2], [-1, -1, P.B], [0, -1, P.S], [1, -1, P.B], [2, -1, P.B], [3, -1, P.BD], [5, -1, P.B]],
  ];
  S.drown = [
    body({ legs: 'stand', hands: [[2, -9]], dy: 2, cut: 0 }),
    body({ legs: 'stand', hands: [[2, -11]], dy: 4, cut: 0 }),
    body({ legs: 'stand', hands: [[1, -12], [2, -13]], dy: 7, cut: 0 }),
    [[1, -3, P.S], [2, -4, P.S], [0, -1, P.W], [3, -2, P.W]],
  ];
  const flames = (k) => {
    const e = [];
    for (let i = 0; i < 12; i++) {
      const x = ((i * 7 + k * 3) % 7) - 3, y = -1 - ((i * 5 + k * 11) % 12);
      e.push([x, y, [P.Y, P.O, P.R][(i + k) % 3]]);
    }
    return e;
  };
  S.burn = [
    body({ legs: 'stand', hands: [[-2, -9], [2, -9]], extra: flames(0) }),
    body({ legs: 'mid', hands: [[-2, -10], [2, -8]], extra: flames(1) }),
    body({ legs: 'none', noBody: true, extra: flames(2).concat([[-1, -2, P.ASH], [0, -2, P.ASH], [-1, -1, P.ASH]]) }),
    [[-1, -2, P.ASH], [0, -2, P.ASH2], [-2, -1, P.ASH2], [-1, -1, P.ASH], [0, -1, P.ASH], [1, -1, P.ASH2]],
  ];
  S.exit = [
    body({ legs: 'kneel', hy: 1, hands: [[1, -5]] }),
    body({ legs: 'dangle', hands: [[-2, -11], [2, -11]], dy: -3 }),
    body({ legs: 'tuck', hands: [[-2, -12], [2, -12]], dy: -5 }),
    body({ legs: 'stand', hands: [[-2, -9], [2, -9]], dy: -1 }),
  ];
  S.stand = [body({ legs: 'stand', hands: [[1, -4]] })];

  /* ---------------- UI icons (lists of [x,y,c], origin top-left) ---------------- */
  const I = (BT.ICONS = {});
  const shift = (list, ox, oy) => list.map((p) => [p[0] + ox, p[1] + oy, p[2]]);
  I.climber = shift(S.climb[0], 6, 12);
  I.floater = shift(S.float[2], 5, 16);
  I.bomber = shift(S.ohno[0], 5, 12).concat([[8, 1, P.Y], [9, 0, P.O]]);
  I.blocker = shift(S.block[0], 5, 12);
  I.builder = shift(S.build[0], 4, 12);
  I.basher = shift(S.bash[2], 3, 12);
  I.miner = shift(S.mine[1], 4, 12);
  I.digger = shift(S.dig[0], 4, 12);
  // mushroom cloud (nuke)
  const nk = [
    '..OOOOO..', '.OYYYYYO.', 'OYYWWYYYO', 'OYWWYYYRO', '.ORRRRRO.', '...OYO...', '...OYO...', '..OYYYO..', '.ORRYRRO.', 'RRRRRRRRR',
  ];
  I.nuke = [];
  nk.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') I.nuke.push([x, y, P[ch]]); }));
})(typeof window !== 'undefined' ? window : globalThis);
