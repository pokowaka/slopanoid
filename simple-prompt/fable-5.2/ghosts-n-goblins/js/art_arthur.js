/*
 * GHOSTS 'N GOBLINS — THE CURSED PC GAMING MUSEUM
 * art_arthur.js — the hero, Sir Arthur, and everything his armour turns into.
 *
 *   arthur_<skin>_<pose>   skin = steel | gold | boxers            (28x32, anchor 14,32 = feet)
 *       idle0..1 run0..5 jump0 fall0 crouch0 climb0..1 throw0..1 throwup0 jthrow0 cthrow0 hurt0 win0
 *   arthur_die0..5         boxers -> skeleton -> pile of bones       (28x32, anchor 14,32)
 *   arthur_soul0..3        the exposed soul (possession leap)        (16x16, centre)
 *   armor_decoy_<steel|gold>0..1   ejected empty suit, 1 = cracked   (18x24, bottom-centre)
 *   plate_<steel|gold>0..4         helmet/breastplate/pauldron/gauntlet/greave shrapnel (8x8, centre)
 *   armor_pickup_<steel|gold>0..1  collectable armour, 1 = glint     (14x14, bottom-centre)
 *   fx_shatter0..5         armour-shatter burst, steel+blue+white only (40x40, centre)
 *   hud_helm0 hud_boxers0 hud_gold0                                  (9x9, top-left)
 *
 * Technique: Arthur is a paper-doll rig. Head / torso / pelvis are hand-pixelled ASCII parts (one
 * set per skin), arms and legs are lit capsule chains driven by joint positions, and ONE pose table
 * drives all three skins (plus the skeleton of the death animation), so they stay perfectly in step.
 * Every part carries its own soft rim (hard blue-black on the silhouette, a dark shade of the
 * material inside the figure). All sprites face RIGHT, light comes from the upper-left.
 *
 * Classic script, loads after engine.js. Registers sprites only; no DOM, no Math.random().
 */
(function () {
  'use strict';
  var GNG = (typeof window !== 'undefined' ? window : globalThis).GNG;
  if (!GNG || !GNG.regSprite) return;
  var Bitmap = GNG.Bitmap, col = GNG.col;
  var OUTLINE = col('outline');
  var W = 28, H = 32;

  /* ====================================================================== *
   *  TOOLKIT
   * ====================================================================== */

  /**
   * Legend builder. spec = { '234567': 'steel:2', x: 'outline' }
   *   'ramp:n' spreads consecutive shades over the key's characters, a plain colour name is given
   *   to every character of the key. shift darkens (-1) / lightens (+1) the ramp entries.
   */
  function mkLegend(spec, shift) {
    var o = {}, key, i;
    shift = shift | 0;
    for (key in spec) {
      var v = spec[key], m = /^([a-z]+):(\d)$/.exec(v);
      for (i = 0; i < key.length; i++) {
        o[key.charAt(i)] = m ? (m[1] + GNG.clamp(+m[2] + i + shift, 0, 7)) : v;
      }
    }
    return GNG.makeLegend(o);
  }
  function merge(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in b) o[k] = b[k];
    return o;
  }

  /*
   * Soft rims: until a frame is assembled, a part's inner rim colour is stored as one of the
   * otherwise unused EGA indices 1..15; resolveRims() turns it into the hard outline where it lies
   * on the sprite's silhouette and into the soft colour where it separates two parts.
   */
  var RIM_COLOUR = [0], RIM_CODE = {};
  function rimCode(name) {
    if (!RIM_CODE[name]) { RIM_COLOUR.push(col(name)); RIM_CODE[name] = RIM_COLOUR.length - 1; }
    return RIM_CODE[name];
  }
  /** Body part from ASCII art with its own 1px rim; compose() coordinates address the art's top-left. */
  function part(legend, art, name, rim) {
    var p = GNG.parseArt(legend, art, 'arthur/' + name).padded(1);
    p.outline(rim ? rimCode(rim) : OUTLINE);
    p.ox = 1; p.oy = 1;
    return p;
  }
  /** Un-rimmed overlay. */
  function decal(legend, art, name) {
    var p = GNG.parseArt(legend, art, 'arthur/' + name);
    p.ox = 0; p.oy = 0;
    return p;
  }
  /** Rim a canvas-sized layer in place (absolute coordinates: compose it at 0,0). */
  function rimAbs(b, rim) {
    b.outline(rim ? rimCode(rim) : OUTLINE);
    b.ox = 0; b.oy = 0;
    return b;
  }
  function resolveRims(b) {
    var w = b.w, h = b.h, d = b.data, out = new Uint8Array(d), x, y, c;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      c = d[y * w + x];
      if (c < 1 || c > 15) continue;
      var edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
        !d[y * w + x - 1] || !d[y * w + x + 1] || !d[(y - 1) * w + x] || !d[(y + 1) * w + x];
      out[y * w + x] = edge ? OUTLINE : RIM_COLOUR[c];
    }
    d.set(out);
    return b;
  }
  /** Assemble layers [part, x, y] back-to-front onto a w*h canvas. Falsy layers are skipped. */
  function compose(w, h, layers) {
    var b = new Bitmap(w, h);
    for (var i = 0; i < layers.length; i++) {
      var l = layers[i];
      if (l) b.blit(l[0], l[1] - l[0].ox, l[2] - l[0].oy);
    }
    return resolveRims(b);
  }
  /** Hard-outline every transparent pixel that touches a fill (non-outline) pixel. */
  function closeOutline(b) {
    var w = b.w, h = b.h, d = b.data, add = [], x, y, i;
    function fill(xx, yy) { var c = (xx < 0 || yy < 0 || xx >= w || yy >= h) ? 0 : d[yy * w + xx]; return c && c !== OUTLINE; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (!d[y * w + x] && (fill(x - 1, y) || fill(x + 1, y) || fill(x, y - 1) || fill(x, y + 1))) add.push(y * w + x);
    }
    for (i = 0; i < add.length; i++) d[add[i]] = OUTLINE;
    return b;
  }
  function reg(name, bmp, anchor) {
    var o = anchor === 'c' ? { ax: bmp.w >> 1, ay: bmp.h >> 1 }
      : anchor === 'tl' ? { ax: 0, ay: 0 }
        : { ax: bmp.w >> 1, ay: bmp.h };
    return GNG.regSprite(name, bmp, o);
  }

  /** Material = [shadow, mid, highlight] of a ramp; s shifts the whole triple (far-side limbs). */
  function M(ramp, lo, mid, hi, s) {
    s = s | 0;
    return [col(ramp + GNG.clamp(lo + s, 0, 7)), col(ramp + GNG.clamp(mid + s, 0, 7)), col(ramp + GNG.clamp(hi + s, 0, 7))];
  }
  function seg(a, b, r, m) { return { a: a, b: b, r: r, m: m }; }
  function distSeg(px, py, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = 0;
    if (l2 > 0) { t = ((px - a[0]) * dx + (py - a[1]) * dy) / l2; t = t < 0 ? 0 : (t > 1 ? 1 : t); }
    var qx = a[0] + t * dx - px, qy = a[1] + t * dy - py;
    return Math.sqrt(qx * qx + qy * qy);
  }
  /**
   * Limb: a union of capsules (later shapes paint over earlier ones), shaded as one rounded volume:
   * highlight on the upper-left edge, shadow on the lower-right edge, mid tone inside.
   * Coordinates are absolute canvas pixels (pixel centres), the result is a cw*ch layer.
   * open = [x, y, r]: no rim is drawn within r of that point, so the limb melts into the body there
   * (a bare shoulder); frame() closes any gap this leaves on the silhouette.
   */
  function limb(shapes, rim, cw, ch, open) {
    cw = cw || W; ch = ch || H;
    var b = new Bitmap(cw, ch), mat = new Int8Array(cw * ch), x, y, i;
    for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
      var hit = 0;
      for (i = 0; i < shapes.length; i++) {
        if (distSeg(x, y, shapes[i].a, shapes[i].b) <= shapes[i].r) hit = i + 1;
      }
      mat[y * cw + x] = hit;
    }
    function on(px, py) { return px >= 0 && py >= 0 && px < cw && py < ch && mat[py * cw + px] > 0; }
    for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
      var k = mat[y * cw + x];
      if (!k) continue;
      var lit = !on(x - 1, y) || !on(x, y - 1), shd = !on(x + 1, y) || !on(x, y + 1);
      var m = shapes[k - 1].m;
      b.data[y * cw + x] = (lit && !shd) ? m[2] : ((shd && !lit) ? m[0] : m[1]);
    }
    rimAbs(b, rim);
    if (open) {
      for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
        if (!mat[y * cw + x] && b.data[y * cw + x] &&
          (x - open[0]) * (x - open[0]) + (y - open[1]) * (y - open[1]) <= open[2] * open[2]) b.data[y * cw + x] = 0;
      }
    }
    return b;
  }
  function mv(pts, dx, dy) {
    return pts.map(function (p) { return [p[0] + dx, p[1] + dy]; });
  }

  /**
   * Cloth ribbon (cape, soul tail): a spine leaving `at` in direction `a` (degrees: 0 = straight
   * back/left, 90 = down, -90 = up), `len` long, half-width w0 -> w1, waving with amplitude amp,
   * wave number k and phase ph (droop bends the far end down). Ends are cut flat like a hem unless
   * o.round. paint(s, cross, depth, x, y, halfWidth) returns the colour of each covered pixel:
   * s = distance along the spine, cross = signed distance from it (+ = upper / outer side).
   */
  function ribbon(o, cw, ch, paint) {
    var n = Math.max(2, Math.ceil(o.len * 3)), i, x, y;
    var a = o.a * Math.PI / 180, dx = -Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    var k = o.k || 0.75, ph = o.ph || 0, sx = [], sy = [], sw = [];
    for (i = 0; i <= n; i++) {
      var t = i / n, s = t * o.len;
      var off = (o.amp || 0) * t * Math.sin(k * s - ph);
      sx.push(o.at[0] + dx * s + nx * off);
      sy.push(o.at[1] + dy * s + ny * off + (o.droop || 0) * t * t);
      sw.push(o.w0 + (o.w1 - o.w0) * t);
    }
    var b = new Bitmap(cw, ch);
    for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
      var best = 1e9, bi = 0;
      for (i = 0; i <= n; i++) {
        var d = Math.sqrt((x - sx[i]) * (x - sx[i]) + (y - sy[i]) * (y - sy[i])) - sw[i];
        if (d < best) { best = d; bi = i; }
      }
      if (best > 0) continue;
      if (!o.round && (bi === 0 || bi === n)) {      // flat-cut ends: a hem, not a blob
        var j = bi === 0 ? 1 : n - 1, ex = sx[bi] - sx[j], ey = sy[bi] - sy[j];
        if ((x - sx[bi]) * ex + (y - sy[bi]) * ey > 0.35 * Math.sqrt(ex * ex + ey * ey)) continue;
      }
      var cross = (x - sx[bi]) * nx + (y - sy[bi]) * ny;
      b.data[y * cw + x] = paint(bi / n * o.len, cross, -best, x, y, sw[bi]);
    }
    return b;
  }

  /* ====================================================================== *
   *  SKINS
   *  A skin = { id, head(view,x,y), torso(view,x,y), pelvis(view,x,y), arm(pts,far,view,side),
   *             leg(pts,far,view), cape(spec,dx,dy), post(bmp,px,py) } - all return layer lists.
   *  Reference frame (idle): torso art top-left (9,14), head (10,7), pelvis (10,21).
   * ====================================================================== */

  /* ---------------------------------------------------------------- armour (steel / gold) */
  var ARMOUR_ART = {
    // great helm, 3/4 view: visor slit with one glinting eye, breaths below
    head_side: `
      ..45665..
      .5677665.
      567776J54
      566665543
      45xxxxwx2
      455665543
      .4556543.
      ..44433..
    `,
    head_back: `
      ..45665..
      .4567654.
      456766543
      456665543
      344444432
      455655443
      .4555443.
      ..33332..
    `,
    head_front: `
      ..56665..
      .5677665.
      567767654
      566656543
      4xxwxwxx2
      456656543
      .4556543.
      ..44433..
    `,
    // empty helm of the ejected decoy: nobody home
    head_empty: `
      ..56665..
      .5677665.
      567767654
      566656543
      4xxx6xxx2
      45xx5xx43
      .4556543.
      ..44433..
    `,
    torso_side: `
      ..455554..
      .456776543
      4567776543
      4567J66432
      4556665432
      .45565432.
      ..344332..
    `,
    torso_back: `
      ..455554..
      .456666543
      4566556543
      4566546432
      4556546432
      .45565432.
      ..344332..
    `,
    torso_front: `
      ..455554..
      .456776543
      4567667543
      456JJ65432
      4556j65432
      .45565432.
      ..344332..
    `,
    // red belt + fauld
    pelvis: `
      rRSRGRRr
      45655443
      34554432
      .34..32.
    `,
    pauldron: `
      .566.
      57765
      56654
      45543
      .rRr.
    `,
    pauldronR: `
      .565.
      56654
      55543
      44432
      .rRr.
    `
  };
  var PLUME_ART = {
    side: `
      .RS.
      RSTR
      rR..
    `,
    back: `
      .RS.
      RSTR
      .rR.
    `,
    low: `
      RSTR
      .rR.
    `
  };

  // cape cloth: lit band along the upper / outer edge, a dark crease, shadowed underside
  var CAPE_PAL = [col('red2'), col('red1'), col('red4'), col('hotred')];
  function capePaint(o) {
    var k = o.k || 0.75, ph = o.ph || 0;
    return function (s, cross, depth, x, y, hw) {
      var v = cross / hw + 0.35 * Math.sin(k * s - ph + 0.8);
      if (v > 0.3) return CAPE_PAL[3];
      if (v > -0.05) return CAPE_PAL[2];
      if (v > -0.3 && hw > 2.2) return CAPE_PAL[1];
      return CAPE_PAL[0];
    };
  }

  function armourSkin(id, R, extra) {
    var spec = merge({
      '1234567': R + ':1', x: 'outline', w: 'bone7',
      r: 'red2', R: 'red4', S: 'hotred', T: 'red6',
      G: 'gold5', J: R + '6', j: R + '5'
    }, extra || {});
    var L = mkLegend(spec), P = {}, n;
    for (n in ARMOUR_ART) P[n] = part(L, ARMOUR_ART[n], id + '.' + n, R + '1');
    var plume = {
      side: part(L, PLUME_ART.side, id + '.plume', 'red1'), back: part(L, PLUME_ART.back, id + '.plumeB', 'red1'),
      low: part(L, PLUME_ART.low, id + '.plumeL', 'red1')
    };
    var rim = R + '1';
    return {
      id: id, ramp: R, legend: L, parts: P, plume: plume,
      head: function (view, x, y) {
        if (view === 'back') return [[plume.back, x + 2, y - 2], [P.head_back, x, y]];
        if (view === 'empty') return [[P.head_empty, x, y], [plume.low, x + 3, y - 1]];
        if (view === 'front') return [[plume.back, x + 3, y - 2], [P.head_front, x, y]];
        return [[plume.side, x, y - 2], [P.head_side, x, y]];
      },
      torso: function (view, x, y) { return [[P['torso_' + (view === 'empty' ? 'front' : view)] || P.torso_side, x, y]]; },
      pelvis: function (view, x, y) { return [[P.pelvis, x, y]]; },
      arm: function (p, far, view, side) {
        var s = far ? -1 : 0;
        var l = [[limb([
          seg(p[0], p[1], 1.2, M(R, 2, 4, 5, s)),
          seg(p[1], p[2], 1.3, M(R, 3, 5, 7, s)),
          seg(p[2], p[2], 1.5, M(R, 3, 5, 7, s))
        ], rim), 0, 0]];
        if (view === 'side') { if (!far) l.push([P.pauldron, p[0][0] - 2, p[0][1] - 2]); }
        else l.push([side === 'F' ? P.pauldronR : P.pauldron, Math.round(p[0][0]) - 2, p[0][1] - 2]);
        return l;
      },
      leg: function (p, far) {
        var s = far ? -1 : 0;
        return [[limb([
          seg(p[0], p[1], 1.6, M(R, 2, 4, 5, s)),
          seg(p[1], p[2], 1.3, M(R, 3, 5, 6, s)),
          seg(p[1], p[1], 1.4, M(R, 4, 6, 7, s)),
          seg(p[2], p[3], 1.05, M(R, 2, 4, 6, s))
        ], rim), 0, 0]];
      },
      cape: null, post: null
    };
  }

  var STEEL = armourSkin('steel', 'steel');
  var GOLD = armourSkin('gold', 'gold', { J: 'hotcyan', j: 'teal4', G: 'hotcyan', w: 'white' });
  GOLD.cape = function (specs, dx, dy) {
    var out = [];
    for (var i = 0; i < specs.length; i++) {
      var o = merge(specs[i], { at: [specs[i].at[0] + dx, specs[i].at[1] + dy] });
      var c = ribbon(o, W, H, capePaint(o));
      c.rect(0, 0, 1, H, 0); c.rect(0, 0, W, 1, 0);          // keep room for the rim at the canvas edge
      out.push([rimAbs(c, 'red1'), 0, 0]);
    }
    return out;
  };

  /* ---------------------------------------------------------------- boxer shorts */
  var BOXERS_ART = {
    head_side: `
      ..CDDDC..
      .CDEDDDC.
      CCDD6666.
      BCD66wx6.
      BC5666667
      BBC5p6DC.
      .BCDDDDC.
      ..BCCCB..
    `,
    // knocked silly: eyes screwed shut, mouth wide open
    head_hurt: `
      ..CDDDC..
      .CDEDDDC.
      CCDD6666.
      BCD6x6x6.
      BC5666667
      BBC5pDxx.
      .BCDDxxC.
      ..BCCCB..
    `,
    head_back: `
      ..CDDDC..
      .CDEDDDC.
      CDEDDDDCB
      CDDDCDCCB
      CCDCDCCBB
      5BCCCCBB4
      .4BCCBB3.
      ...4554..
    `,
    head_front: `
      ..CDDDC..
      .CDEDDDC.
      CD66666DC
      C6wx6wx6B
      B56666665
      BpDD66DDp
      .BDDwwDB.
      ..BCCCB..
    `,
    torso_side: `
      ...4554...
      .45666654.
      .566766543
      .566666543
      .456663543
      ..5666554.
      ..5665543.
    `,
    torso_back: `
      ...4554...
      .45666654.
      .56665665.
      .56655654.
      .45665654.
      ..566565..
      ..556554..
    `,
    torso_front: `
      ...4554...
      .45666654.
      .56665665.
      .56365635.
      .45666654.
      ..566665..
      ..5663654.
    `,
    pelvis: `
      .PPPPPPPP.
      VWWWWWWWVU
      VWWWWWWWVU
      VWWWWWWVVU
      VWWWVUWWVU
    `
  };
  var BERRY = col('hotred'), LEAF = col('green5'), CLOTH_HI = col('white'), CLOTH_MID = col('bone7');
  var BOXERS = (function () {
    var spec = {
      '234567': 'skin:2', 'BCDE': 'brown:2', x: 'outline', w: 'mist7', p: 'red6',
      W: 'white', V: 'bone7', U: 'mist5', P: 'pink4'
    };
    var L = mkLegend(spec), P = {}, n;
    for (n in BOXERS_ART) {
      P[n] = part(L, BOXERS_ART[n], 'boxers.' + n, n === 'pelvis' ? 'skin2' : (/^head/.test(n) ? 'brown1' : 'skin1'));
    }
    var CLOTH = [col('mist5'), col('bone7'), col('white')];
    return {
      id: 'boxers', parts: P,
      head: function (view, x, y) { return [[P['head_' + view] || P.head_side, x, y]]; },
      torso: function (view, x, y) { return [[P['torso_' + view] || P.torso_side, x, y]]; },
      pelvis: function (view, x, y) { return [[P.pelvis, x - 1, y]]; },
      arm: function (p, far) {
        var s = far ? -1 : 0;
        return [[limb([
          seg(p[0], p[1], 1.2, M('skin', 3, 5, 6, s)),
          seg(p[1], p[2], 1.1, M('skin', 3, 5, 6, s)),
          seg(p[2], p[2], 1.3, M('skin', 4, 6, 7, s))
        ], 'skin1', W, H, far ? null : [p[0][0], p[0][1], 2.6]), 0, 0]];
      },
      leg: function (p, far) {
        var s = far ? -1 : 0, hip = p[0], knee = p[1];
        var mid = [hip[0] + (knee[0] - hip[0]) * 0.65, hip[1] + (knee[1] - hip[1]) * 0.65];
        return [[limb([
          seg(hip, knee, 1.3, M('skin', 3, 5, 6, s)),
          seg(knee, p[2], 1.15, M('skin', 3, 5, 6, s)),
          seg(p[2], p[3], 1.0, M('skin', 3, 5, 6, s)),
          seg(hip, mid, 1.9, far ? [col('mist4'), col('mist6'), col('bone7')] : CLOTH)
        ], 'skin1'), 0, 0]];
      },
      cape: null,
      // strawberry print: a staggered lattice of red berries with a green leaf, pinned to the waistband
      post: function (b, px, py) {
        var x, y, u, v;
        function cloth(xx, yy) { var c = b.get(xx, yy); return c === CLOTH_HI || c === CLOTH_MID; }
        for (y = py + 1; y < py + 10; y++) for (x = px - 6; x < px + 16; x++) {
          u = ((x - px) % 4 + 4) % 4; v = y - py;
          if (!((u === 1 && (v === 2 || v === 6)) || (u === 3 && v === 4))) continue;
          if (cloth(x, y) && cloth(x, y - 1)) { b.pset(x, y, BERRY); b.pset(x, y - 1, LEAF); }
        }
      }
    };
  })();

  /* ---------------------------------------------------------------- bare bones (death) */
  var BONES_ART = {
    head_side: `
      ..566665.
      .56777765
      567777665
      56xx66xx5
      56xx66xx4
      .5666x654
      ..5w6w6w.
      ..45554..
    `,
    torso_side: `
      ....65....
      .56666665.
      ..5xxx6x5.
      .56666665.
      ..5xxx6x4.
      ..566665..
      ....65....
    `,
    pelvis: `
      ..5665..
      .566665.
      .54..54.
    `,
    boneH: `
      66...66
      .66666.
      .55555.
      55...54
    `,
    boneD: `
      .66....
      676....
      5666...
      ..665..
      ...6656
      ....555
      ....54.
    `,
    boneE: `
      ....66.
      ....676
      ...6665
      ..665..
      6665...
      565....
      .55....
    `,
    ribs: `
      .5666665.
      ..5xxx65.
      56666665.
      ..5xxx54.
    `
  };
  var BONES = (function () {
    var L = mkLegend({ '1234567': 'bone:1', x: 'outline', w: 'bone7' }), P = {}, n;
    for (n in BONES_ART) P[n] = part(L, BONES_ART[n], 'bones.' + n, 'bone1');
    function bone(p, far, r) {
      var s = far ? -2 : 0, sh = [], i;
      for (i = 0; i + 1 < p.length; i++) sh.push(seg(p[i], p[i + 1], r, M('bone', 4, 6, 7, s)));
      for (i = 0; i < p.length; i++) sh.push(seg(p[i], p[i], 1.0, M('bone', 4, 6, 7, s)));
      return [[limb(sh, 'bone1'), 0, 0]];
    }
    return {
      id: 'bones', parts: P,
      head: function (view, x, y) { return [[P.head_side, x, y]]; },
      torso: function (view, x, y) { return [[P.torso_side, x, y]]; },
      pelvis: function (view, x, y) { return [[P.pelvis, x + 1, y]]; },
      arm: function (p, far) { return bone(p, far, 0.75); },
      leg: function (p, far) { return bone(p, far, 0.75); },
      cape: null, post: null
    };
  })();

  /* ====================================================================== *
   *  THE RIG
   *  pose = { view: 'side'|'back'|'front', head: variant, o:[dx,dy] whole upper body, to:[dx,dy] torso+
   *           head+arms on top of that, ho: head only, po: pelvis only,
   *           aN/aF: arm joints [shoulder, elbow, wrist] in REFERENCE coords (they follow the torso),
   *           lN/lF: leg joints [hip, knee, ankle, toe] in ABSOLUTE canvas coords,
   *           cape: [ribbon specs] (reference coords), <skinId>: { per-skin overrides } }
   * ====================================================================== */
  var Z = [0, 0];
  function frame(skin, pose) {
    var P = pose[skin.id] ? merge(pose, pose[skin.id]) : pose;
    var o = P.o || Z, to = P.to || Z, ho = P.ho || Z, po = P.po || Z, view = P.view || 'side';
    var dx = o[0] + to[0], dy = o[1] + to[1];
    var tx = 9 + dx, ty = 13 + dy, hx = tx + 1 + ho[0], hy = ty - 7 + ho[1];
    var px = 10 + o[0] + po[0], py = 20 + o[1] + po[1];
    var side = view === 'side', L = [];
    function add(layers) { if (layers) for (var i = 0; i < layers.length; i++) L.push(layers[i]); }
    dy -= 1;                                   // arm / cape reference frame: torso top at y 14
    var cape = (skin.cape && P.cape) ? skin.cape(P.cape, dx, dy) : null;
    var aN = P.aN && skin.arm(mv(P.aN, dx, dy), 0, view, 'N');
    var aF = P.aF && skin.arm(mv(P.aF, dx, dy), side ? 1 : 0, view, 'F');
    if (view !== 'back') add(cape);
    if (side) add(aF);
    if (P.lF) add(skin.leg(P.lF, side ? 1 : 0, view));
    if (P.lN) add(skin.leg(P.lN, 0, view));
    add(P.mid);
    if (!P.noTorso) add(skin.torso(view, tx, ty));
    if (!P.noPelvis) add(skin.pelvis(view, px, py));
    if (view === 'back') add(cape);
    if (side) {
      if (!P.noHead) add(skin.head(P.head || view, hx, hy));
      add(aN);
    } else {
      add(aF); add(aN);
      if (!P.noHead) add(skin.head(P.head || view, hx, hy));
    }
    add(P.front);
    var b = compose(P.cw || W, P.ch || H, L);
    closeOutline(b);                           // close the silhouette where a rim was left open
    if (skin.post) skin.post(b, px, py);
    return b;
  }

  /* ---------------------------------------------------------------- pose table */
  var HN = [12.5, 22], HF = [15.5, 22];
  function hip(h, bob) { return [h[0], h[1] + bob]; }
  // run-cycle leg keys: [knee, ankle, toe], x relative to the hip, y absolute (ground line = 30.5)
  var LEG_KEYS = {
    front: [[3.5, 25.8], [6, 29.6], [8.3, 28.6]],     // heel strike, toe up
    recoil: [[2.2, 26.5], [0.5, 30.5], [3, 30.5]],    // weight on the bent leg
    pass: [[-0.3, 26], [-1.5, 30.5], [1, 30.5]],      // pushing back under the body
    toeoff: [[-2, 26.3], [-5.5, 28.8], [-4.6, 30.9]], // trailing, heel up
    kick: [[-1.8, 26.6], [-6, 26.5], [-6.8, 28.5]],   // shin flicked up behind
    drive: [[4, 24.5], [3, 28.5], [5.3, 29.3]]        // knee punching forward
  };
  function runLeg(h, key, bob) {
    var k = LEG_KEYS[key], out = [hip(h, bob)];
    for (var i = 0; i < 3; i++) out.push([h[0] + k[i][0], k[i][1]]);
    return out;
  }
  var ARM_KEYS = [
    [[11, 16], [8, 18], [6.5, 20.5]],        // 0 back
    [[11, 16], [9, 19], [9, 22]],            // 1
    [[11, 16], [11.5, 19.5], [14, 20.5]],    // 2
    [[11, 16], [13.5, 19], [16.5, 17.5]],    // 3 forward
    [[11, 16], [12, 19.5], [14.5, 20.5]],    // 4
    [[11, 16], [9.5, 19], [9.5, 22]]         // 5
  ];
  // the embarrassed knight pumps his arms like a cartoon sprinter
  var ARM_KEYS_FRANTIC = [
    [[11, 16], [7.5, 16.5], [5.5, 19]],
    [[11, 16], [8.5, 18.5], [8, 21.5]],
    [[11, 16], [12, 19.5], [15, 19]],
    [[11, 16], [14, 18], [16.5, 14.5]],
    [[11, 16], [12.5, 19.5], [15.5, 18.5]],
    [[11, 16], [9, 18.5], [7.5, 21]]
  ];
  var RUN_N = ['front', 'recoil', 'pass', 'toeoff', 'kick', 'drive'];
  var RUN_BOB = [0, 1, 0, 0, 1, 0];
  var RUN_CAPE = [6, 12, 16, 10, 4, 0];           // the cape lifts and drops with every stride
  var RUN_HN = [13.3, 22], RUN_HF = [14.7, 22];   // hips swing in line while running: a clean scissor

  var IDLE_LN = [HN, [12.5, 26], [12, 30.5], [14.5, 30.5]], IDLE_LF = [HF, [16, 26], [16, 30.5], [18.5, 30.5]];
  var IDLE_AN = [[11, 16], [9.5, 19.5], [10.5, 22.5]], IDLE_AF = [[17, 16], [18.5, 19], [19, 22]];
  var REACH = [[12, 16], [16.5, 16.5], [21, 16.5]];             // release: arm thrown straight forward
  // leap: lead knee up, rear leg tucked behind
  var JUMP_LN = [HN, [17, 23.5], [16.5, 27.5], [19, 28]], JUMP_LF = [HF, [14, 26], [10, 26.5], [9, 28.5]];
  // duck: down on the far knee, near knee up in front
  var SQUAT_LN = [[12, 28], [17.5, 27.3], [17, 30.5], [19.5, 30.5]], SQUAT_LF = [[14, 28.5], [14.5, 30.3], [9.5, 30.5], [7.5, 30.5]];
  var SQUAT = { o: [0, 9], ho: [1, 2], po: [-1, -2] };
  var CAPE_AT = [10, 15];
  function cape(a, len, amp, ph, more) {
    return [merge({ at: CAPE_AT, a: a, len: len, w0: 1.4, w1: 3.6, amp: amp, ph: ph }, more || {})];
  }
  var CAPE_BACK = { at: [13.5, 15.5], a: 90, len: 11, w0: 3.6, w1: 5, amp: 0.5, ph: 0 };

  var POSES = {
    idle0: { aN: IDLE_AN, aF: IDLE_AF, lN: IDLE_LN, lF: IDLE_LF, cape: cape(74, 13, 0.8, 0) },
    idle1: { to: [0, 1], aN: IDLE_AN, aF: IDLE_AF, lN: IDLE_LN, lF: IDLE_LF, cape: cape(76, 12, 0.8, 1.4) },
    jump0: {
      aN: [[11, 16], [8.5, 17], [6.5, 14.5]], aF: [[17, 16], [20, 17.5], [22, 15.5]],
      lN: JUMP_LN, lF: JUMP_LF, cape: cape(54, 11.5, 1.2, 0.5)
    },
    fall0: {
      aN: [[11, 16], [8, 14.5], [7, 11.5]], aF: [[17, 16], [20.5, 15], [22, 12]],
      lN: [HN, [12.5, 26], [11, 29.5], [11.8, 31.2]], lF: [HF, [18, 25.5], [18.5, 29.3], [20.3, 30.8]],
      cape: cape(-62, 11, 1.6, 2, { w1: 3.2 })
    },
    crouch0: merge(SQUAT, {
      aN: [[11, 16], [10.5, 19.5], [13.5, 20.5]],
      lN: SQUAT_LN, lF: SQUAT_LF, cape: cape(50, 8, 0.6, 0, { w1: 3.8 })
    }),
    climb0: {
      view: 'back',
      aN: [[10, 16], [7.5, 13.5], [8, 9.5]], aF: [[17, 16], [20, 16.5], [19.5, 13]],
      lN: [[12, 22], [11.5, 26.5], [11.5, 30.5], [11.5, 30.5]], lF: [[15.5, 22], [17.5, 24.5], [16.5, 28], [16.5, 28]],
      cape: [CAPE_BACK]
    },
    climb1: {
      view: 'back',
      aN: [[10, 16], [7, 16.5], [7.5, 13]], aF: [[17, 16], [19.5, 13.5], [19, 9.5]],
      lN: [[12, 22], [10, 24.5], [11, 28], [11, 28]], lF: [[15.5, 22], [16, 26.5], [16, 30.5], [16, 30.5]],
      cape: [merge(CAPE_BACK, { ph: 3.1 })]
    },
    throw0: {
      to: [-1, 0],
      aN: [[11, 16], [8, 14], [6.5, 11]], aF: [[17, 16], [20, 17.5], [22.5, 17]],
      lN: [HN, [11.5, 26], [10, 30.5], [12.5, 30.5]], lF: [HF, [17.5, 26], [17.5, 30.5], [20, 30.5]],
      cape: cape(74, 11, 0.9, 0.6)
    },
    throw1: {
      to: [1, 0],
      aN: REACH, aF: [[15, 16], [10, 18], [7.5, 19.5]],
      lN: [HN, [10.5, 26], [8.5, 30.5], [11, 30.5]], lF: [HF, [18.5, 26], [18, 30.5], [20.5, 30.5]],
      cape: cape(40, 11, 1.6, 2.4)
    },
    throwup0: {
      aN: [[10.5, 16], [8.5, 11.5], [10, 6.5]], aF: [[17, 16], [19.5, 18.5], [20, 21.5]],
      lN: [HN, [12, 26], [11, 30.5], [13.5, 30.5]], lF: [HF, [16.5, 26], [17, 30.5], [19.5, 30.5]],
      cape: cape(76, 11, 0.9, 1.8)
    },
    jthrow0: {
      to: [1, 0],
      aN: REACH, aF: [[15, 16], [10, 18], [7.5, 19.5]],
      lN: JUMP_LN, lF: JUMP_LF, cape: cape(20, 10, 1.8, 1)
    },
    cthrow0: merge(SQUAT, {
      to: [1, 0],
      aN: [[12, 17], [16.5, 17], [21, 16.5]],
      lN: SQUAT_LN, lF: SQUAT_LF, cape: cape(38, 8, 1.2, 2, { w1: 3.8 })
    }),
    hurt0: {
      o: [-1, -1], to: [-1, 0], head: 'hurt',
      aN: [[11, 16], [8, 13.5], [6, 10.5]], aF: [[17, 16], [20.5, 14], [22.5, 11]],
      lN: [[11.5, 21], [15.5, 23.5], [19, 25], [20.5, 23.5]], lF: [[14.5, 21], [18, 25], [16.5, 28.5], [19, 29]],
      cape: cape(-28, 9.5, 2, 1)
    },
    win0: {
      view: 'front',
      aN: [[10, 16], [7.5, 19], [10, 21.5]], aF: [[17, 16], [20, 13], [20.5, 8.5]],
      lN: [[12, 22], [11, 26], [10.5, 30.5], [8.5, 30.5]], lF: [[15.5, 22], [16.5, 26], [17, 30.5], [19, 30.5]],
      cape: [{ at: [13.5, 15.5], a: 90, len: 13, w0: 4.5, w1: 8.5, amp: 0.8, ph: 0.5 }]
    }
  };
  (function () {
    for (var i = 0; i < 6; i++) {
      var bob = RUN_BOB[i];
      POSES['run' + i] = {
        o: [0, bob], to: [1, 0],
        aN: ARM_KEYS[i], aF: mv(ARM_KEYS[(i + 3) % 6], 6, 0),
        lN: runLeg(RUN_HN, RUN_N[i], bob), lF: runLeg(RUN_HF, RUN_N[(i + 3) % 6], bob),
        cape: cape(RUN_CAPE[i], 9.4, 3, i * Math.PI / 3, { droop: 1.5, w0: 1.2, w1: 3.1, k: 0.85 }),
        boxers: { aN: ARM_KEYS_FRANTIC[i], aF: mv(ARM_KEYS_FRANTIC[(i + 3) % 6], 6, 0) }
      };
    }
  })();

  var SKINS = [STEEL, GOLD, BOXERS];
  (function () {
    for (var s = 0; s < SKINS.length; s++) {
      for (var name in POSES) reg('arthur_' + SKINS[s].id + '_' + name, frame(SKINS[s], POSES[name]));
    }
  })();

  /* ====================================================================== *
   *  B. DEATH: boxer-shorts Arthur buckles -> kneels -> skeleton -> pile of bones (28x32)
   * ====================================================================== */
  (function () {
    var B = BONES.parts;
    var BUCKLE = {
      o: [-1, 1], to: [-1, 0], head: 'hurt',
      aN: [[11, 16], [8, 13.5], [6.5, 10.5]], aF: [[17, 16], [20.5, 14.5], [22.5, 12]],
      lN: [[11.5, 23], [14.5, 26.5], [11.5, 30.5], [14, 30.5]], lF: [[14.5, 23], [18.5, 26.5], [16.5, 30.5], [19, 30.5]]
    };
    var KNEEL = {
      o: [0, 5], to: [1, 0], ho: [1, 1], head: 'hurt',
      aN: [[11, 16], [11.5, 19.5], [13, 22.5]], aF: [[17, 16], [18.5, 19.5], [19.5, 22.5]],
      lN: [[12.5, 27], [17, 29.8], [11.5, 30.5], [9.5, 30.5]], lF: [[15.5, 27], [19.5, 29.8], [14, 30.5], [12, 30.5]]
    };
    reg('arthur_die0', frame(BOXERS, BUCKLE));
    reg('arthur_die1', frame(BOXERS, KNEEL));
    reg('arthur_die2', frame(BONES, KNEEL));
    // the skeleton comes apart: skull tips forward, ribs sag, limbs drop
    reg('arthur_die3', compose(W, H, [
      [B.boneD, 4, 22], [B.boneE, 17, 23],
      [B.boneH, 13, 28], [B.pelvis, 9, 28],
      [B.torso_side, 8, 22],
      [B.boneH, 5, 28],
      [B.head_side, 12, 15]
    ]));
    reg('arthur_die4', compose(W, H, [
      [B.boneE, 16, 24], [B.boneD, 5, 24],
      [B.ribs, 9, 26], [B.boneH, 15, 28], [B.boneH, 4, 28],
      [B.head_side, 10, 17]
    ]));
    reg('arthur_die5', compose(W, H, [
      [B.boneD, 4, 25], [B.boneE, 17, 25],
      [B.ribs, 9, 27], [B.boneH, 16, 28], [B.boneH, 3, 28], [B.boneH, 10, 28],
      [B.head_side, 9, 20]
    ]));
  })();

  /* ====================================================================== *
   *  C. THE SOUL: a teal wisp with Arthur's bearded face and a flickering tail (16x16)
   * ====================================================================== */
  (function () {
    var GLOW = [col('teal5'), col('teal6'), col('teal7'), col('white')], RIM = col('teal2');
    function tone(d) { return d > 2.2 ? GLOW[3] : (d > 1.4 ? GLOW[2] : (d > 0.7 ? GLOW[1] : GLOW[0])); }
    // the face: glowing brow, two eyes, and the beard he is so proud of
    var FACE = decal(mkLegend({ '4567': 'teal:5', 7: 'white', b: 'teal4', B: 'teal3', x: 'outline' }), `
      ..45554..
      .4566654.
      456777654
      46777x7x5
      467777765
      45bBbBbb5
      .4BbBBbB4
      .4bBBBb4.
      ..4bBb4..
      ...4b4...
    `, 'soul.face');
    var DIR = [-14, 6, 18, -2], MOTE = [[1, 3], [2, 13], [0, 12], [1, 6]];
    for (var f = 0; f < 4; f++) {
      var b = ribbon({ at: [8.5, 7.5], a: DIR[f], len: 8, w0: 2.1, w1: 0.3, amp: 2.1, k: 0.95, ph: f * Math.PI / 2, round: true },
        16, 16, function (s, cross, depth) { return tone(depth + 0.3); });
      b.blit(FACE, 6, 2 + (f & 1));
      b.pset(MOTE[f][0], MOTE[f][1], GLOW[1 + (f & 1)]);       // a loose mote of ectoplasm
      b.outline(RIM);
      reg('arthur_soul' + f, b, 'c');
    }
  })();

  /* ====================================================================== *
   *  D. ARMOUR DECOY: the ejected, empty suit standing on its own (18x24)
   * ====================================================================== */
  function crackLine(b, pts, c) {
    for (var i = 0; i + 1 < pts.length; i++) {
      var x0 = pts[i][0], y0 = pts[i][1], x1 = pts[i + 1][0], y1 = pts[i + 1][1];
      var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
      for (var t = 0; t <= n; t++) {
        var x = Math.round(x0 + (x1 - x0) * t / n), y = Math.round(y0 + (y1 - y0) * t / n), cur = b.get(x, y);
        if (cur && cur !== OUTLINE) b.pset(x, y, c);
      }
    }
  }
  (function () {
    var skins = [STEEL, GOLD];
    for (var s = 0; s < 2; s++) {
      var sk = skins[s], R = sk.ramp;
      for (var f = 0; f < 2; f++) {
        var b = frame(sk, {
          view: 'front', head: 'empty', cw: 18, ch: 24, o: [-5, -4], ho: f ? [1, 1] : Z,
          aN: [[10, 16], [8.5, 19.5], f ? [9, 22.5] : [8.5, 22.5]], aF: [[17, 16], [18.5, 19.5], [18.5, 22.5]],
          lN: [[7.5, 18], [7.5, 20.5], [7, 22.5], [5.5, 22.5]], lF: [[10.5, 18], [10.5, 20.5], [11, 22.5], [12.5, 22.5]]
        });
        if (f) {
          // about to break: cracks run through helm and cuirass, the plate is dented dull
          var dark = col(R + '2'), dull = col(R + '3');
          crackLine(b, [[12, 10], [10, 12], [11, 14], [9, 15]], dull);
          crackLine(b, [[5, 12], [6, 14]], dull);
          crackLine(b, [[9, 3], [10, 5], [9, 7], [11, 9]], OUTLINE);
          crackLine(b, [[11, 10], [9, 12], [10, 14], [8, 16], [9, 18]], OUTLINE);
          crackLine(b, [[4, 11], [5, 13], [4, 15]], OUTLINE);
          crackLine(b, [[12, 20], [11, 22]], OUTLINE);
          crackLine(b, [[8, 4], [8, 5]], dark);
        }
        reg('armor_decoy_' + sk.id + f, b);
      }
    }
  })();

  /* ====================================================================== *
   *  E. SHRAPNEL (8x8)  F. PICKUP (14x14)  H. HUD ICONS (9x9)
   * ====================================================================== */
  var PLATE_ART = [`
    .4665.
    467765
    5xxxw3
    456543
    45x543
    .4443.
  `, `
    56..54
    577654
    567653
    456543
    .4543.
    ..43..
  `, `
    ..466.
    .57765
    467654
    45543.
    443r..
    .r....
  `, `
    .565..
    .5654.
    .4r43.
    577654
    466543
    .4443.
  `, `
    .454..
    .4654.
    .4654.
    .4543.
    .46654
    .44433
  `];
  var PICKUP_ART = `
    ...rS.......
    ...45665....
    ..4677654...
    ..5xxxxx3...
    ..4566543...
    .4544443454.
    456776655543
    456766554432
    .4566J54432.
    .4556554432.
    ..rRSGRRr...
    ..34554432..
  `;
  var HUD_HELM = `
    .RS....
    ..5665.
    .577654
    5xxxwx3
    4566543
    .45543.
    ..443..
  `;
  function boxed(legend, art, name, w, h) {
    var p = part(legend, art, name);
    return compose(w, h, [[p, (w - (p.w - 2)) >> 1, (h - (p.h - 2)) >> 1]]);
  }
  /** Glint: a bright diagonal sweep across the metal plus a four-point sparkle. */
  function glint(b, R, sx, sy) {
    var g = b.clone(), ramp = GNG.RAMPS[R], x, y, i, white = col('white');
    for (y = 0; y < g.h; y++) for (x = 0; x < g.w; x++) {
      var d = x + y - (g.w - 1);
      if (d < -1 || d > 0) continue;
      i = ramp.indexOf(g.get(x, y));
      if (i >= 0) g.pset(x, y, i >= 5 ? white : ramp[i + 2]);
    }
    g.pset(sx, sy, white); g.pset(sx - 1, sy, white); g.pset(sx + 1, sy, white);
    g.pset(sx, sy - 1, white); g.pset(sx, sy + 1, white);
    g.pset(sx - 2, sy, col(R + '6')); g.pset(sx + 2, sy, col(R + '6'));
    g.pset(sx, sy - 2, col(R + '6')); g.pset(sx, sy + 2, col(R + '6'));
    return g;
  }
  (function () {
    var skins = [STEEL, GOLD], i;
    for (var s = 0; s < 2; s++) {
      var sk = skins[s], id = sk.id;
      for (i = 0; i < PLATE_ART.length; i++) reg('plate_' + id + i, boxed(sk.legend, PLATE_ART[i], id + '.plate' + i, 8, 8), 'c');
      var pk = boxed(sk.legend, PICKUP_ART, id + '.pickup', 14, 14);
      reg('armor_pickup_' + id + '0', pk);
      reg('armor_pickup_' + id + '1', glint(pk, sk.ramp, 4, 4));
    }
    reg('hud_helm0', boxed(STEEL.legend, HUD_HELM, 'hud.helm', 9, 9), 'tl');
    reg('hud_gold0', boxed(GOLD.legend, HUD_HELM, 'hud.gold', 9, 9), 'tl');
    var shorts = boxed(mkLegend({ W: 'white', V: 'bone7', U: 'mist5', P: 'pink4', s: 'hotred', g: 'green5' }), `
      PPPPPPP
      WgWWWgV
      WsWgWsV
      WWWsWVU
      WWV.WVU
      VVU.VUU
    `, 'hud.boxers', 9, 9);
    reg('hud_boxers0', shorts, 'tl');
  })();

  /* ====================================================================== *
   *  G. SHATTER BURST (40x40): flash -> expanding ring of shards and sparks.
   *  Steel + blue ramps + white ONLY: the game turns it golden with
   *  GNG.rampSwap({ steel: 'gold', blue: 'orange' }).
   * ====================================================================== */
  (function () {
    var S = 40, C = 20, rng = GNG.makeRng(0x5A77E2), N = 13, M2 = 20, shards = [], sparks = [], i, f;
    for (i = 0; i < N; i++) {
      shards.push({
        a: (i + rng() * 0.7) / N * Math.PI * 2, v: 0.75 + rng() * 0.3, sz: 2 + rng() * 1.5,
        rot: rng() * 6.28, spin: (rng() - 0.5) * 2.2, tone: (rng() * 3) | 0
      });
    }
    for (i = 0; i < M2; i++) sparks.push({ a: rng() * 6.28, v: 0.8 + rng() * 0.6 });
    var TONES = [M('steel', 3, 5, 7), M('steel', 2, 4, 6), [col('steel4'), col('steel6'), col('white')]];
    var white = col('white'), B = GNG.RAMPS.blue;
    var RAD = [0, 9, 11.5, 14, 16, 17.5];              // how far the shards have flown
    var SPARK = [white, white, white, B[6], B[5], B[3]];
    function glowDisc(b, r, core) {
      for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
        var d = Math.sqrt((x - C + 0.5) * (x - C + 0.5) + (y - C + 0.5) * (y - C + 0.5));
        if (d > r) continue;
        var t = d / r + (GNG.bayer(x, y) - 0.5) * 0.25;
        b.pset(x, y, t < core ? white : (t < 0.8 ? B[7] : (t < 0.93 ? B[6] : B[4])));
      }
    }
    function rays(b, len, c0, c1) {
      var D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
      for (var k = 0; k < 8; k++) {
        var l = k < 4 ? len : len * 0.55;
        for (var t = 2; t < l; t++) {
          b.pset(Math.round(C - 0.5 + D[k][0] * t), Math.round(C - 0.5 + D[k][1] * t), t < l * 0.6 ? c0 : c1);
        }
      }
    }
    function ring(b, r, c, gaps) {
      for (var k = 0; k < 96; k++) {
        var a = k / 96 * 6.2832;
        if (gaps && GNG.hash2(k >> 1, r | 0, 7) < gaps) continue;
        b.pset(Math.round(C - 0.5 + Math.cos(a) * r), Math.round(C - 0.5 + Math.sin(a) * r), c);
      }
    }
    for (f = 0; f < 6; f++) {
      var b = new Bitmap(S, S);
      if (f === 0) { rays(b, 13, white, B[6]); glowDisc(b, 6.5, 0.6); }
      if (f === 1) { rays(b, 18, B[7], B[5]); glowDisc(b, 8, 0.5); ring(b, 10.5, B[6], 0.2); }
      if (f === 2) { ring(b, 12, B[6], 0.25); ring(b, 13, B[4], 0.5); glowDisc(b, 4.5, 0.3); }
      if (f === 3) { ring(b, 15.5, B[5], 0.55); ring(b, 16.5, B[3], 0.7); }
      if (f === 4) ring(b, 18, B[3], 0.75);
      if (f >= 1) {
        // shards: little spinning triangles of plate, lit from the upper-left
        var m = new Bitmap(S, S), x, y;
        for (i = 0; i < N; i++) {
          var sh = shards[i], r = RAD[f] * sh.v, cx = C - 0.5 + Math.cos(sh.a) * r, cy = C - 0.5 + Math.sin(sh.a) * r + (f - 1) * (f - 1) * 0.12;
          var sz = sh.sz * (1 - (f - 1) * 0.13), rot = sh.rot + sh.spin * f, pts = [];
          for (var k = 0; k < 3; k++) {
            var ang = rot + k * 2.094 + (k === 1 ? 0.5 : 0);
            pts.push([cx + Math.cos(ang) * sz * (k === 0 ? 1.5 : 1), cy + Math.sin(ang) * sz * (k === 0 ? 1.5 : 1)]);
          }
          m.poly(pts, sh.tone + 1);
          if (!m.get(Math.round(cx), Math.round(cy))) m.pset(Math.round(cx), Math.round(cy), sh.tone + 1);
        }
        for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
          var t = m.get(x, y);
          if (!t) continue;
          var lit = !m.get(x - 1, y) || !m.get(x, y - 1), shd = !m.get(x + 1, y) || !m.get(x, y + 1);
          b.pset(x, y, TONES[t - 1][(lit && !shd) ? 2 : ((shd && !lit) ? 0 : 1)]);
        }
        for (i = 0; i < M2; i++) {
          var sp = sparks[i], rr = (RAD[f] + 2.5) * sp.v;
          if (f >= 4 && (i & 1)) continue;
          b.pset(Math.round(C - 0.5 + Math.cos(sp.a) * rr), Math.round(C - 0.5 + Math.sin(sp.a) * rr), SPARK[f]);
          if (f < 4) b.pset(Math.round(C - 0.5 + Math.cos(sp.a) * (rr - 1.2)), Math.round(C - 0.5 + Math.sin(sp.a) * (rr - 1.2)), f < 3 ? B[6] : B[4]);
        }
      }
      reg('fx_shatter' + f, b, 'c');
    }
  })();

})();
