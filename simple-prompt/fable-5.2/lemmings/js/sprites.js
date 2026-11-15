/* BEAT TRIBE - procedural lemming sprites.
 * No sprite sheets: every animation frame is plotted pixel by pixel into a 16x16
 * palette-indexed cell.  The foot pixel (lemming x,y) sits at cell (7,15). */
(function (g) {
  'use strict';
  var BT = g.BT, hex = BT.hex;

  // palette indices
  var HAIR = 1, SKIN = 2, ROBE = 3, WHITE = 4, ROBED = 5, TAN = 6, RED = 7, YEL = 8, STEEL = 9, HAIRD = 10, SPLASH = 11, ORANGE = 12, ASH = 13;
  var PAL = [0, 0x30c828, 0xf8c8a0, 0x4860f8, 0xffffff, 0x2c3cc0, 0xc88848, 0xe82828, 0xffe040, 0xb8c0d0, 0x1c9018, 0x90d0ff, 0xff9020, 0x606068].map(function (c) { return c ? hex(c) : 0; });
  var PAL_GREY = PAL.map(function (c) { return c ? BT.mix(BT.grey(c, 1), hex(0x8088a0), 0.25) : 0; });
  var PAL_HOT = PAL.map(function (c) { return c ? BT.mix(c, hex(0xffffff), 0.45) : 0; });

  function cell() { return new Uint8Array(256); }
  function P(s, dx, dy, c) { var x = 7 + dx, y = 15 + dy; if (x >= 0 && x < 16 && y >= 0 && y < 16) s[y * 16 + x] = c; }
  function many(s, list, oy) { for (var i = 0; i < list.length; i++) P(s, list[i][0], list[i][1] + (oy || 0), list[i][2] === undefined ? SKIN : list[i][2]); }

  // Side view, facing right.  o: by (crouch), hb (head bob), hx (head lean), feet, hands, px (extra pixels)
  function side(o) {
    var s = cell(), by = o.by || 0, hb = by + (o.hb || 0), hx = o.hx || 0, r;
    P(s, -1, -5 + by, ROBED); P(s, 0, -5 + by, ROBE);
    for (r = -4; r <= -1; r++) { P(s, -1, r + by, ROBED); P(s, 0, r + by, ROBE); P(s, 1, r + by, ROBE); }
    many(s, o.feet || [[-1, 0], [1, 0]]);
    P(s, hx - 1, -9 + hb, HAIR); P(s, hx, -9 + hb, HAIR); P(s, hx + 1, -9 + hb, HAIR);
    P(s, hx - 2, -8 + hb, HAIR); P(s, hx - 1, -8 + hb, HAIR); P(s, hx, -8 + hb, HAIR); P(s, hx + 1, -8 + hb, HAIRD);
    P(s, hx - 2, -7 + hb, HAIRD); P(s, hx - 1, -7 + hb, HAIR); P(s, hx, -7 + hb, SKIN); P(s, hx + 1, -7 + hb, SKIN);
    P(s, hx - 1, -6 + hb, HAIRD); P(s, hx, -6 + hb, SKIN); P(s, hx + 1, -6 + hb, SKIN); P(s, hx + 2, -6 + hb, SKIN);
    many(s, o.hands || [], by);
    many(s, o.px || []);
    return s;
  }
  // Front (or back) view.  o: by, hb, hx, feet, hands, px, back
  function front(o) {
    var s = cell(), by = o.by || 0, hb = by + (o.hb || 0), hx = o.hx || 0, r, f = o.back ? HAIR : SKIN;
    for (r = -5; r <= -1; r++) { P(s, -1, r + by, ROBED); P(s, 0, r + by, ROBE); P(s, 1, r + by, ROBE); }
    many(s, o.feet || [[-1, 0], [1, 0]]);
    P(s, hx - 1, -9 + hb, HAIR); P(s, hx, -9 + hb, HAIR); P(s, hx + 1, -9 + hb, HAIR);
    for (r = -2; r <= 2; r++) P(s, hx + r, -8 + hb, r === 2 ? HAIRD : HAIR);
    P(s, hx - 2, -7 + hb, HAIR); P(s, hx - 1, -7 + hb, f); P(s, hx, -7 + hb, f); P(s, hx + 1, -7 + hb, f); P(s, hx + 2, -7 + hb, HAIRD);
    P(s, hx - 1, -6 + hb, f); P(s, hx, -6 + hb, f); P(s, hx + 1, -6 + hb, f);
    many(s, o.hands || [], by);
    many(s, o.px || []);
    return s;
  }
  function recolor(s, map) { var o = cell(), i; for (i = 0; i < 256; i++) o[i] = s[i] ? (map[s[i]] || s[i]) : 0; return o; }
  function shift(s, dy) {
    var o = cell(), x, y, ny;
    for (y = 0; y < 16; y++) { ny = y + dy; if (ny < 0 || ny > 15) continue; for (x = 0; x < 16; x++) o[ny * 16 + x] = s[y * 16 + x]; }
    return o;
  }

  var A = {};

  // WALK: 8 frames = two steps; the head dips on each footfall (frames 0 and 4).
  var wk = [
    { hb: 1, feet: [[-2, 0], [1, 0]], hands: [[2, -3]] },
    { feet: [[-1, -1], [1, 0]], hands: [[1, -3]] },
    { feet: [[0, 0]], hands: [[0, -3, ROBED]] },
    { feet: [[0, 0], [1, -1]], hands: [[-1, -3]] }
  ];
  A.walk = [0, 1, 2, 3, 0, 1, 2, 3].map(function (i) { return side(wk[i]); });

  A.fall = [
    side({ feet: [[-1, 0], [1, 0]], hands: [[-2, -8], [3, -8]], px: [[0, -10, HAIR], [-1, -10, HAIR]] }),
    side({ feet: [[-2, 0], [2, 0]], hands: [[-3, -7], [3, -9]], px: [[0, -10, HAIR], [1, -10, HAIR], [2, -1, ROBE], [-2, -1, ROBED]] }),
    side({ feet: [[-1, 0], [1, 0]], hands: [[-2, -9], [3, -7]], px: [[0, -10, HAIR], [-1, -10, HAIR]] }),
    side({ feet: [[-2, 0], [2, 0]], hands: [[-3, -8], [2, -9]], px: [[-1, -10, HAIR], [1, -10, HAIR], [2, -1, ROBE], [-2, -1, ROBED]] })
  ];

  function brolly(sx) {       // umbrella canopy + shaft above the head
    var p = [], x;
    for (x = -2; x <= 2; x++) p.push([x + sx, -15, (x & 1) ? WHITE : RED]);
    for (x = -4; x <= 4; x++) p.push([x + sx, -14, ((x + 8) % 4 < 2) ? RED : WHITE]);
    for (x = -5; x <= 5; x++) p.push([x + sx, -13, ((x + 9) % 4 < 2) ? RED : WHITE]);
    p.push([-5 + sx, -12, RED], [5 + sx, -12, RED], [-1 + sx, -12, RED], [3 + sx, -12, RED]);
    p.push([1, -12, STEEL], [1, -11, STEEL], [1, -10, STEEL]);
    return p;
  }
  A.float = [
    side({ feet: [[-1, 0], [1, 0]], hands: [[1, -10]], px: brolly(0) }),
    side({ feet: [[-2, 0], [0, 0]], hands: [[1, -10]], px: brolly(0) }),
    side({ feet: [[-1, 0], [1, 0]], hands: [[1, -10]], px: brolly(1) }),
    side({ feet: [[0, 0], [2, 0]], hands: [[1, -10]], px: brolly(1) })
  ];

  var cl = [
    { feet: [[1, 0], [0, -2]], hands: [[2, -9], [2, -5]] },
    { feet: [[1, -1], [0, -1]], hands: [[2, -8], [2, -6]] },
    { feet: [[1, -2], [0, 0]], hands: [[2, -5], [2, -9]] },
    { feet: [[1, -1], [0, -1]], hands: [[2, -6], [2, -8]] }
  ];
  A.climb = [0, 1, 2, 3, 0, 1, 2, 3].map(function (i) { cl[i].hx = 0; return side(cl[i]); });
  A.hoist = [6, 4, 2, 1].map(function (d) { return shift(side({ hx: 1, hands: [[3, -5], [3, -6]], feet: [[-1, 0], [0, 0]] }), d); });

  var brick = [[2, -3, TAN], [3, -3, TAN], [4, -3, TAN]];
  A.build = [
    side({ hands: [[2, -4]], px: brick }),
    side({ hands: [[2, -4]], px: brick }),
    side({ hb: 1, hx: 1, hands: [[2, -3]], px: [[3, -2, TAN], [4, -2, TAN], [5, -2, TAN]] }),
    side({ by: 1, hb: 1, hx: 1, hands: [[3, -2]], px: [[3, 0, TAN], [4, 0, TAN], [5, 0, TAN]] }),
    side({ by: 1, hb: 1, hx: 1, hands: [[3, -1]], px: [[2, 0, TAN], [3, 0, TAN], [4, 0, TAN], [5, 0, TAN]] }),
    side({ hb: 1, hx: 1, hands: [[2, -2]] }),
    side({ hands: [[1, -3]] }),
    side({ hands: [[2, -4]] })
  ];

  A.bash = [
    side({ hx: 1, hands: [[3, -5], [4, -5]], px: [[5, -6, TAN]] }),
    side({ hx: 1, hands: [[3, -5], [4, -4]], px: [[6, -4, TAN]] }),
    side({ hands: [[2, -4]] }),
    side({ hands: [[1, -4], [2, -3]], feet: [[-1, 0], [2, 0]] }),
    side({ hx: 1, hands: [[3, -3], [4, -3]], px: [[5, -2, TAN]] }),
    side({ hx: 1, hands: [[3, -3], [4, -2]], px: [[6, -3, TAN]] }),
    side({ hands: [[2, -4]] }),
    side({ hands: [[1, -5], [2, -5]], feet: [[-2, 0], [1, 0]] })
  ];

  A.mine = [
    side({ hands: [[1, -10]], px: [[-1, -11, STEEL], [0, -12, STEEL], [1, -12, STEEL], [2, -11, STEEL], [1, -11, TAN]] }),
    side({ hands: [[2, -9]], px: [[2, -11, STEEL], [3, -11, STEEL], [4, -10, STEEL], [3, -10, TAN]] }),
    side({ hx: 1, hands: [[3, -6]], px: [[4, -7, TAN], [5, -8, STEEL], [5, -6, STEEL], [6, -7, STEEL]] }),
    side({ hx: 1, hb: 1, hands: [[3, -3]], px: [[4, -2, TAN], [5, -3, STEEL], [5, -1, STEEL], [6, -2, STEEL], [7, 0, TAN]] }),
    side({ hx: 1, hb: 1, hands: [[3, -2]], px: [[4, -1, TAN], [5, -2, STEEL], [5, 0, STEEL], [6, -1, STEEL], [6, -4, TAN]] }),
    side({ hb: 1, hands: [[3, -3]], px: [[4, -3, TAN], [5, -4, STEEL], [5, -2, STEEL]] }),
    side({ hands: [[2, -5]], px: [[3, -6, TAN], [4, -7, STEEL], [3, -8, STEEL]] }),
    side({ hands: [[2, -8]], px: [[2, -9, TAN], [1, -11, STEEL], [3, -10, STEEL], [2, -11, STEEL]] })
  ];

  var dg = [
    { by: 2, hb: 0, hands: [[-3, -2], [3, -5]], px: [[-4, -3, TAN]] },
    { by: 2, hb: 1, hands: [[-3, -1], [3, -4]], px: [[-5, -5, TAN]] },
    { by: 2, hb: 0, hands: [[-3, -3], [3, -3]], px: [[-5, -8, TAN], [5, -2, TAN]] },
    { by: 2, hb: 0, hands: [[-3, -5], [3, -2]], px: [[4, -3, TAN]] },
    { by: 2, hb: 1, hands: [[-3, -4], [3, -1]], px: [[5, -5, TAN]] },
    { by: 2, hb: 0, hands: [[-3, -3], [3, -3]], px: [[5, -8, TAN], [-5, -2, TAN]] }
  ];
  A.dig = [0, 1, 2, 3, 4, 5, 0, 3].map(function (i) { dg[i].feet = []; return front(dg[i]); });

  A.block = [
    front({ hb: 1, feet: [[-2, 0], [2, 0]], hands: [[-3, -4], [3, -4], [-2, -4, ROBED], [2, -4, ROBE]] }),
    front({ feet: [[-2, 0], [2, 0]], hands: [[-3, -5], [3, -5], [-2, -4, ROBED], [2, -4, ROBE]] }),
    front({ feet: [[-2, 0], [2, 0]], hands: [[-3, -4], [3, -4], [-2, -4, ROBED], [2, -4, ROBE]] }),
    front({ feet: [[-2, 0], [2, 0]], hands: [[-3, -3], [3, -3], [-2, -4, ROBED], [2, -4, ROBE]] })
  ];
  A.shrug = [
    front({ hands: [[-2, -3], [2, -3]] }),
    front({ hands: [[-3, -4], [3, -4], [-2, -4, ROBED], [2, -4, ROBE]] }),
    front({ hb: 1, hands: [[-3, -6], [3, -6], [-2, -5, ROBED], [2, -5, ROBE]] }),
    front({ hands: [[-3, -4], [3, -4], [-2, -4, ROBED], [2, -4, ROBE]] })
  ];
  A.ohno = [
    front({ hx: -1, hands: [[-3, -8], [1, -8], [-2, -5, ROBED], [2, -5, ROBE]] }),
    front({ hx: 0, hands: [[-2, -8], [2, -8], [-2, -5, ROBED], [2, -5, ROBE]] }),
    front({ hx: 1, hands: [[-1, -8], [3, -8], [-2, -5, ROBED], [2, -5, ROBE]] }),
    front({ hx: 0, hb: 1, hands: [[-2, -8], [2, -8], [-2, -5, ROBED], [2, -5, ROBE]] })
  ];

  // SPLAT: squash into the floor.
  (function () {
    var f = [], s;
    s = cell(); many(s, [[-2, -4, HAIR], [-1, -5, HAIR], [0, -5, HAIR], [1, -5, HAIR], [2, -4, HAIRD], [-1, -4, SKIN], [0, -4, SKIN], [1, -4, SKIN],
      [-2, -3, ROBED], [-1, -3, ROBE], [0, -3, ROBE], [1, -3, ROBE], [2, -3, ROBE], [-2, -2, ROBED], [-1, -2, ROBE], [0, -2, ROBE], [1, -2, ROBE], [2, -2, ROBE],
      [-3, -1, ROBED], [-2, -1, ROBE], [-1, -1, ROBE], [0, -1, ROBE], [1, -1, ROBE], [2, -1, ROBE], [3, -1, ROBE], [-3, 0, SKIN], [3, 0, SKIN]]); f.push(s);
    s = cell(); many(s, [[-2, -2, HAIR], [-1, -3, HAIR], [0, -3, HAIR], [1, -2, HAIRD], [0, -2, SKIN], [-1, -2, SKIN],
      [-3, -1, ROBED], [-2, -1, ROBE], [-1, -1, ROBE], [0, -1, ROBE], [1, -1, ROBE], [2, -1, ROBE], [3, -1, ROBE],
      [-4, 0, ROBED], [-3, 0, ROBE], [-2, 0, ROBE], [-1, 0, ROBE], [0, 0, ROBE], [1, 0, ROBE], [2, 0, ROBE], [3, 0, ROBE], [4, 0, SKIN], [-5, 0, SKIN]]); f.push(s);
    s = cell(); many(s, [[-1, -1, HAIR], [0, -1, HAIR], [1, -1, SKIN], [-5, 0, ROBED], [-4, 0, ROBE], [-3, 0, ROBE], [-2, 0, HAIR], [-1, 0, ROBE], [0, 0, ROBE],
      [1, 0, ROBE], [2, 0, SKIN], [3, 0, ROBE], [4, 0, ROBE], [5, 0, ROBE], [-6, -2, ROBE], [6, -3, HAIR], [-3, -4, SKIN]]); f.push(s);
    s = cell(); many(s, [[-6, 0, ROBED], [-4, 0, ROBE], [-3, 0, HAIR], [-1, 0, ROBE], [0, 0, ROBE], [2, 0, ROBE], [3, 0, SKIN], [5, 0, ROBE], [6, 0, ROBE],
      [-7, -4, ROBE], [7, -5, HAIR], [-4, -7, SKIN], [3, -6, ROBE]]); f.push(s);
    s = cell(); many(s, [[-6, 0, ROBED], [-3, 0, ROBE], [0, 0, ROBE], [3, 0, ROBE], [6, 0, ROBE], [-7, -3, ROBE], [7, -4, HAIR], [-5, -8, SKIN], [4, -8, ROBE]]); f.push(s);
    s = cell(); many(s, [[-5, 0, ROBED], [0, 0, ROBE], [5, 0, ROBE], [-7, -1, ROBE], [7, -2, HAIR]]); f.push(s);
    A.splat = f;
  })();

  // DROWN: sinks while waving.
  A.drown = [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
    var s = shift(front({ feet: [], hands: (i & 1) ? [[-3, -9], [3, -7]] : [[-3, -7], [3, -9]] }), 2 + i);
    many(s, [[-4, 0, SPLASH], [4, 0, SPLASH], [-3 - (i & 1), -1, WHITE], [3 + (i & 1), -1, WHITE], [-2, 0, SPLASH], [2, 0, SPLASH], [0, 0, i > 5 ? SPLASH : 0], [-5, -2 - (i & 3), SPLASH], [5, -1 - ((i + 2) & 3), SPLASH]]);
    return s;
  });

  // BURN: body turns to flame, then to ash.
  A.burn = [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
    var s, x, y, hgt;
    if (i < 2) return recolor(front({ hands: [[-3, -7 - i], [3, -7 - i]] }), { 1: ORANGE, 10: RED, 3: ORANGE, 5: RED, 2: YEL });
    s = cell();
    if (i < 6) {
      for (x = -2; x <= 2; x++) {
        hgt = 10 - Math.abs(x) * 2 - ((x + i) & 1) * 2 - (i - 2);
        for (y = 0; y < hgt; y++) P(s, x, -y, y < hgt / 3 ? YEL : y < hgt * 0.7 ? ORANGE : RED);
      }
    }
    many(s, [[-2, 0, ASH], [-1, 0, ASH], [0, 0, ASH], [1, 0, ASH], [2, 0, ASH]]);
    if (i < 7) many(s, [[-1, -1, ASH], [0, -1, ASH], [1, -1, i < 6 ? ASH : 0], [0, -3 - i, ASH]]);
    return s;
  });

  // EXIT: celebration hop, back to the viewer, then steps into the door.
  A.exit = [0, -2, -3, -2, 0, -1, 0, 0].map(function (dy, i) {
    var up = i < 5;
    var s = front({ back: true, feet: up ? [[-1, 0], [1, 0]] : [[0, 0]], hands: up ? [[-3, -8], [3, -8], [-2, -6, ROBED], [2, -6, ROBE]] : [[-2, -3], [2, -3]] });
    s = shift(s, dy);
    if (i === 7) { for (var k = 0; k < 256; k++) if (((k >> 4) + (k & 15)) & 1) s[k] = 0; }
    return s;
  });

  // mirrored copies for left-facing lemmings
  function mirror(s) { var o = cell(), x, y; for (y = 0; y < 16; y++) for (x = 0; x < 15; x++) o[y * 16 + (14 - x)] = s[y * 16 + x]; return o; }
  var AL = {};
  Object.keys(A).forEach(function (k) { AL[k] = A[k].map(mirror); });

  BT.Sprites = { R: A, L: AL, PAL: PAL, PAL_GREY: PAL_GREY, PAL_HOT: PAL_HOT };
})(typeof window !== 'undefined' ? window : globalThis);
