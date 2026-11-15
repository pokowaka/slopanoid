/*
 * GHOSTS 'N GOBLINS — THE CURSED PC GAMING MUSEUM
 * art_foes_a.js — enemy art, set A: the ground undead + every enemy projectile.
 *
 *   zombie_*  zbucc_*  zmarine_*   rise0..3 walk0..3 spit0 (20x28)  + zombie_burrow0..1 (20x10)
 *   skel_*    walk0..3 throw0..1 rise0..2 (20x28)
 *   skelsw_*  walk0..3 guard0 lunge0..1 (28x28)
 *   harmor_*  walk0..3 slash0..1 (24x32)
 *   lem_*     walk0..3 block0..1 ohno0..1 fall0 (12x14)  float0..1 (16x24)
 *   p_*       bone0..3 fireball0..2 acid0..1 skullfire0..1 coconut0 banana0..3 magic0..2 bolt0..1
 *
 * Technique: every creature is a little paper-doll. Body parts are hand-pixelled as ASCII art
 * (fill colours only), each part gets its own 1px 'outline' rim, and the frames are assembled
 * back-to-front on the sprite canvas. Variants swap legends and parts, so they stay in step.
 * All sprites face RIGHT, light comes from the upper-left.
 */
(function () {
  'use strict';
  var GNG = (typeof window !== 'undefined' ? window : globalThis).GNG;
  var Bitmap = GNG.Bitmap;
  var OUTLINE = GNG.col('outline');

  /* ====================================================================== *
   *  TOOLKIT
   * ====================================================================== */

  /**
   * Legend builder. spec = { 'abcd': 'olive:2', x: 'outline' }
   *   'ramp:n' spreads consecutive shades over the key's characters (a=olive2, b=olive3 ...),
   *   a plain colour name is given to every character of the key.
   * shift darkens (-1) / lightens (+1) the ramp entries: used for limbs on the far side.
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

  /*
   * Soft rims. A part's 1px rim is the hard blue-black 'outline' wherever it ends up on the sprite's
   * silhouette, but where it merely separates two overlapping parts INSIDE the figure it may use a dark
   * shade of the part's own colour instead (Capcom style). Until a frame is assembled such rims are
   * stored as the otherwise unused EGA indices 1..15.
   */
  var RIM_COLOUR = [0], RIM_CODE = {};
  function rimCode(name) {
    if (!RIM_CODE[name]) { RIM_COLOUR.push(GNG.col(name)); RIM_CODE[name] = RIM_COLOUR.length - 1; }
    return RIM_CODE[name];
  }

  /**
   * Body part: parsed art + its own 1px rim. (x,y) given to compose() address the art's top-left.
   * opts.rim  = colour name of the rim where it lies inside the figure (default: hard outline).
   * opts.open = [x0, y0, x1, y1] (art coords, inclusive): no rim is drawn there, so that end of the
   *             part melts into whatever it is attached to (a sleeve into a shoulder).
   */
  function part(legend, art, name, opts) {
    return rimmed(GNG.parseArt(legend, art, 'foes_a/' + name), opts);
  }
  function rimmed(raw, opts) {
    var p = raw.padded(1), x, y, open = opts && opts.open;
    p.outline(opts && opts.rim ? rimCode(opts.rim) : OUTLINE);
    if (open) {
      for (y = Math.max(-1, open[1]); y <= Math.min(raw.h, open[3]); y++) {
        for (x = Math.max(-1, open[0]); x <= Math.min(raw.w, open[2]); x++) {
          if (!raw.get(x, y)) p.pset(x + 1, y + 1, 0);
        }
      }
    }
    p.ox = 1; p.oy = 1;
    return p;
  }

  /** Stripes: copy bitmap b over a on every stripe. st = [axis 'x'|'y', period, width, phase]. */
  function stripe(a, b, st) {
    for (var y = 0; y < a.h; y++) for (var x = 0; x < a.w; x++) {
      var t = (st[0] === 'x' ? x : y) + (st[3] | 0);
      if (t % st[1] < st[2]) a.data[y * a.w + x] = b.data[y * a.w + x];
    }
  }

  function merge(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in b) o[k] = b[k];
    return o;
  }

  /** Un-outlined overlay (details painted on top of a part). */
  function decal(legend, art, name) {
    var p = GNG.parseArt(legend, art, 'foes_a/' + name);
    p.ox = 0; p.oy = 0;
    return p;
  }

  /** Turn rim codes into real colours: hard outline on the silhouette, the soft colour inside. */
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

  function reg(name, bmp, centre) {
    return GNG.regSprite(name, bmp, centre ? { ax: bmp.w >> 1, ay: bmp.h >> 1 } : { ax: bmp.w >> 1, ay: bmp.h });
  }

  /* ====================================================================== *
   *  1. ZOMBIE FAMILY  (20x28)
   * ====================================================================== */

  var ZOMBIE = {
    '234567': 'zombie:2',     // rotten skin
    'abcde': 'olive:1',       // ragged tunic
    'lmno': 'brown:2',        // trousers
    'hi': 'slate:2',          // lank hair
    'gf': 'tan:2',            // rope belt
    x: 'outline',             // voids: sockets, maw, tears
    r: 'hotred',              // ember eyes
    w: 'bone6',               // teeth, ribs
    R: 'red3',                // old blood
    G: 'toxic5',              // bile
    k: 'outline'
  };
  var DIRT = { 'yvut': 'brown:2', s: 'sand5', k: 'outline' };

  var Z_ART = {
    head: `
      ..5665..
      .566665.
      h5666655
      ih4xx5x5
      hi4xr5r5
      .i554435
      .h4xwxw4
      ..34xxx4
      ...3444.
    `,
    headSpit: `
      ..5665..
      .566665.
      h5666655
      ih4xx5x5
      hi4xr5r5
      .i554435
      .h4xwxwx
      ..4xxxxx
      ..34xxwx
      ...3444.
    `,
    torso: `
      ...dee...
      .ddeeedc.
      ddeeddccc
      deedccccb
      dedcccbcb
      dedccxccb
      dddccwxcb
      .ddcbccba
      .fgfgfgfa
      .dccbcbba
      .dcbccbab
      .c.cb.b.a
    `,
    armFwd: `
      .dd........
      eddc55555..
      dccb4444555
      .cb.....454
      ........4.5
      ..........4
    `,
    armUp: `
      6.5.4
      5.5.4
      55544
      .5544
      .554.
      .54..
      .54..
      .544.
      cddc.
      cddcb
    `,
    armDown: `
      ddc..
      eddc.
      .dcb.
      .554.
      .54..
      .54..
      .544.
      .5543
    `,
    legPass: `
      nnnm..
      onnm..
      onnm..
      onnmm.
      .onnm.
      .onnm.
      .nmnm.
      .54...
      .5544.
      .55543
    `,
    legFwd: `
      nnnm....
      onnnm...
      .onnm...
      .onnnm..
      ..onnm..
      ..onnm..
      ...nmn..
      ...544.4
      ...55443
    `,
    legBack: `
      ....nnnm
      ...onnnm
      ...onnm.
      ..onnm..
      ..onnm..
      .onnm...
      .nmn....
      54......
      5543....
    `,
    legLift: `
      nnnm...
      onnnm..
      .onnnm.
      .onnnm.
      .onnm..
      onnm...
      nmn....
      54.....
      5543...
    `
  };
  // per-part options: soft rims for the skin parts, sleeves that melt into the shoulder
  var Z_OPT = {
    head: { rim: 'zombie1' }, headSpit: { rim: 'zombie1' },
    armFwd: { rim: 'zombie1', open: [-1, -1, 1, 9] },
    armUp: { rim: 'zombie1' }, armDown: { rim: 'zombie1', open: [-1, -1, 1, 1] }
  };
  var BILE = decal(mkLegend({ 'GH': 'toxic:4' }), `
    GH.
    .GH
    ..G
  `, 'bile');

  var MOUND = part(mkLegend(DIRT), `
    ....uu....tu....
    ..tuuvu..tuvvu..
    .tuvvvuutuvvyvu.
    tuvvyvvuuvvyvvvu
    uvyyvvyvvyvvyyvv
  `, 'mound');
  var CLOD = part(mkLegend(DIRT), `
    tu
    uv
  `, 'clod');

  /*
   * A kit = every body part of one zombie flavour, near-side and (one shade darker) far-side.
   * cfg: { id, spec, specs:{part: spec}, art, artFar:{part: art}, opt:{part: opts},
   *        handles:{part:[dx,dy]}, stripes:{part: st}, stripeSpec }
   */
  function zombieKit(cfg) {
    var K = {}, n, far;
    for (n in cfg.art) {
      for (far = 0; far < 2; far++) {
        var own = !(far && cfg.artFar && cfg.artFar[n]);
        var art = own ? cfg.art[n] : cfg.artFar[n];
        var spec = (cfg.specs && cfg.specs[n]) || cfg.spec;
        var id = 'foes_a/' + cfg.id + '.' + n + (far ? '_far' : '');
        var raw = GNG.parseArt(mkLegend(spec, -far), art, id);
        var st = cfg.stripes && cfg.stripes[n];
        if (st) stripe(raw, GNG.parseArt(mkLegend(merge(spec, cfg.stripeSpec), -far), art, id), st);
        var opt = own ? merge(Z_OPT[n] || {}, (cfg.opt && cfg.opt[n]) || {}) : Z_OPT[n];
        var p = rimmed(raw, opt);
        var hd = own && cfg.handles && cfg.handles[n];
        if (hd) { p.ox += hd[0]; p.oy += hd[1]; }
        K[n + (far ? '_far' : '')] = p;
      }
    }
    return K;
  }

  function buildZombie(prefix, K) {
    var W = 20, H = 28;
    // walk: 0 contact (near leg forward) / 1 passing / 2 contact (far leg forward) / 3 passing
    var walk = [
      { bob: 1, near: [K.legFwd, 4], far: [K.legBack_far, 2] },
      { bob: 0, near: [K.legPass, 4], far: [K.legLift_far, 5] },
      { bob: 1, near: [K.legBack, 1], far: [K.legFwd_far, 5] },
      { bob: 0, near: [K.legLift, 4], far: [K.legPass_far, 5] }
    ];
    for (var i = 0; i < 4; i++) {
      var f = walk[i], b = f.bob;
      reg(prefix + 'walk' + i, compose(W, H, [
        [K.armFwd_far, 8, 9 + b],
        [f.far[0], f.far[1], 17 + b],
        [f.near[0], f.near[1], 17 + b],
        [K.torso, 2, 6 + b],
        [K.head, 7, 1 + b],
        [K.armFwd, 7, 12 + b]
      ]));
    }
    // spit: body pitched forward, neck craned, arms flung back
    reg(prefix + 'spit0', compose(W, H, [
      [K.armDown_far, 3, 13],
      [K.legBack_far, 2, 18],
      [K.legFwd, 5, 18],
      [K.torso, 3, 8],
      [K.armDown, 2, 13],
      [K.headSpit, 9, 5],
      [BILE, 17, 12]
    ]));
    // rise: hand -> head & shoulders -> waist -> full
    reg(prefix + 'rise0', compose(W, H, [
      [K.armUp, 8, 13],
      [MOUND, 2, 22],
      [CLOD, 3, 18], [CLOD, 15, 16]
    ]));
    reg(prefix + 'rise1', compose(W, H, [
      [K.torso, 2, 19],
      [K.head, 6, 14],
      [K.armUp, 14, 13],
      [MOUND, 2, 22],
      [CLOD, 2, 17], [CLOD, 17, 9]
    ]));
    reg(prefix + 'rise2', compose(W, H, [
      [K.armFwd_far, 8, 16],
      [K.torso, 2, 13],
      [K.head, 7, 8],
      [K.armDown, 10, 15],
      [MOUND, 2, 22]
    ]));
    reg(prefix + 'rise3', compose(W, H, [
      [K.armFwd_far, 8, 13],
      [K.legPass_far, 5, 20],
      [K.legPass, 4, 20],
      [K.torso, 2, 9],
      [K.head, 7, 4],
      [K.armFwd, 7, 16],
      [MOUND, 2, 25]
    ]));
  }

  /* ---- the classic graveyard zombie ---- */
  buildZombie('zombie_', zombieKit({ id: 'zombie', spec: ZOMBIE, art: Z_ART }));

  /* ---- zombie buccaneer: red bandana, eye-patch, striped shirt, peg leg, cutlass ---- */
  var BUCC = merge(ZOMBIE, {
    'abcde': 'bone:2',        // grubby white shirt ...
    'lmno': 'rust:1',         // breeches
    'gf': 'red:3',            // sash
    'ABCD': 'red:2',          // bandana
    E: 'hotyellow',           // earring
    'STU': 'steel:5',         // cutlass blade
    'XY': 'gold:3',           // hilt
    Q: 'tan3', P: 'tan5'      // peg leg
  });
  var BUCC_ART = merge(Z_ART, {
    head: `
      ..BCCB..
      .BCDCCB.
      ABCCBBBA
      Akkkk5x5
      AA4kk5r5
      .A554435
      .E4xwxw4
      ..34xxx4
      ...3444.
    `,
    headSpit: `
      ..BCCB..
      .BCDCCB.
      ABCCBBBA
      Akkkk5x5
      AA4kk5r5
      .A554435
      .E4xwxwx
      ..4xxxxx
      ..34xxwx
      ...3444.
    `,
    armFwd: `
      ........U..
      ........UT.
      ........UTS
      ........UTS
      ........UTS
      ........UTS
      ........UT.
      ........UT.
      .dd....XYYY
      eddc5555545
      dccb4444454
      .cb.....44.
    `,
    armUp: `
      ..U..
      ..UT.
      .UTS.
      .UTS.
      .UTS.
      .UTS.
      .UTS.
      XYYYX
      .555.
      .545.
      .554.
      .54..
      .54..
      .544.
      cddc.
      cddcb
    `,
    armDown: `
      ddc..
      eddc.
      .dcb.
      .554.
      .54..
      .54..
      .545.
      XYYYX
      .UTS.
      .UTS.
      .UTS.
      .UTS.
      .UT..
      ..U..
    `,
    legPass: `
      nnnm..
      onnm..
      onnm..
      onnmm.
      .onnm.
      .onnm.
      .nmnm.
      ..PQ..
      ..PQ..
      ..PQ..
    `,
    legFwd: `
      nnnm....
      onnnm...
      .onnm...
      .onnnm..
      ..onnm..
      ..onnm..
      ...nmn..
      ....PQ..
      .....PQ.
    `,
    legBack: `
      ....nnnm
      ...onnnm
      ...onnm.
      ..onnm..
      ..onnm..
      .onnm...
      .nmn....
      .PQ.....
      PQ......
    `,
    legLift: `
      nnnm...
      onnnm..
      .onnnm.
      .onnnm.
      .onnm..
      onnm...
      nmn....
      PQ.....
      PQ.....
    `
  });
  buildZombie('zbucc_', zombieKit({
    id: 'zbucc', spec: BUCC, art: BUCC_ART,
    artFar: { armFwd: Z_ART.armFwd, armUp: Z_ART.armUp, armDown: Z_ART.armDown,
      legPass: Z_ART.legPass, legFwd: Z_ART.legFwd, legBack: Z_ART.legBack, legLift: Z_ART.legLift },
    opt: { armFwd: { open: [-1, 7, 1, 13] } },
    handles: { armFwd: [0, 8], armUp: [0, 6] },
    stripeSpec: { 'abcde': 'blue:1' },
    stripes: { torso: ['y', 2, 1, 1], armFwd: ['x', 2, 1, 1], armUp: ['y', 2, 1, 0], armDown: ['y', 2, 1, 1] }
  }));

  /* ---- zombified space marine: green armour, cracked helmet, life-support pack ---- */
  var MARINE = merge(ZOMBIE, {
    'abcde': 'green:2',       // armour plate
    'lmno': 'green:1',        // fatigues
    'ABCDE': 'green:2',       // helmet
    'IJKL': 'steel:2',        // backpack / fittings
    V: 'hotcyan',             // smashed visor glass
    Y: 'gold5'                // buckle
  });
  var MARINE_BOOTS = merge(MARINE, { '234567': 'brown:1' });
  var MARINE_ART = merge(Z_ART, {
    head: `
      ...CDDC..
      .BDEDDCB.
      BCDDDkCCB
      AAABkkAAV
      JKA4xx5xV
      JJA4xr5r5
      AAB554435
      .AA4xwxw4
      ..A34xxx4
      ...A3444.
    `,
    headSpit: `
      ...CDDC..
      .BDEDDCB.
      BCDDDkCCB
      AAABkkAAV
      JKA4xx5xV
      JJA4xr5r5
      AAB554435
      .AA4xwxwx
      ..A4xxxxx
      ..A34xxwx
      ...A3444.
    `,
    torso: `
      ..KLLK...
      .KLLLLJd.
      KLLKKKJed
      KLrKIKJed
      KLKKIKJdc
      KKKKIJcdc
      KJJJJJccb
      .IIIabcba
      .IIIIIYIa
      .cddcdcba
      .cdcddcbb
      .c.cd.c.b
    `
  });
  buildZombie('zmarine_', zombieKit({
    id: 'zmarine', spec: MARINE, art: MARINE_ART,
    specs: { legPass: MARINE_BOOTS, legFwd: MARINE_BOOTS, legBack: MARINE_BOOTS, legLift: MARINE_BOOTS },
    opt: { head: { rim: 'green0' }, headSpit: { rim: 'green0' } },
    handles: { head: [1, 1], headSpit: [1, 1] }
  }));

  /* ---- burrowing: a travelling mound of churned earth with clawing fingers ---- */
  var CLAW = part(mkLegend(ZOMBIE), `
    5.5.4
    5.5.4
    55544
    .554.
    .54..
  `, 'claw', { rim: 'zombie1' });
  var BURROW_MOUNDS = [`
    ....tut.....tu....
    ..tuuuvut.tuuvut..
    .tuvvuvvuuuvvyvut.
    tuvyvvyvvuvvyyvvvu
    uvyyvyyvyyvyyvyyvv
  `, `
    ......tut......t..
    ..tutuuuvuttutuuu.
    .tuvuvvuvvuuvvuvvt
    tuvvyvyvvyvvyvyyvu
    uyvyyvyyvyyvvyyvyv
  `];
  reg('zombie_burrow0', compose(20, 10, [
    [CLAW, 9, 1],
    [part(mkLegend(DIRT), BURROW_MOUNDS[0], 'burrow0'), 1, 4]
  ]));
  reg('zombie_burrow1', compose(20, 10, [
    [CLAW, 12, 2],
    [part(mkLegend(DIRT), BURROW_MOUNDS[1], 'burrow1'), 1, 4],
    [CLOD, 4, 1]
  ]));

  /* ====================================================================== *
   *  2. SKELETONS
   * ====================================================================== */

  var BONE = { '1234567': 'bone:1', x: 'outline', w: 'white', k: 'outline' };
  var BONE_L = mkLegend(BONE), BONE_FAR = mkLegend(BONE, -2);
  var BONE_RIM = null;      // bones always get the hard outline: white on black is the whole look

  /**
   * Long bones: a chain through the joints `pts`. thick[i] = 2 (femur, humerus) or 1 (shin, forearm)
   * for segment i; every joint gets a 2x2 knob. Lit along the upper/left edge, shaded lower/right.
   * Returned as a canvas-sized rimmed part.
   */
  function limb(w, h, pts, shift, thick) {
    var t1 = new Bitmap(w, h), t2 = new Bitmap(w, h), m = new Bitmap(w, h), i, x, y;
    shift = shift | 0;
    for (i = 0; i + 1 < pts.length; i++) {
      ((thick && thick[i] === 1) ? t1 : t2).line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1);
    }
    for (i = 0; i < pts.length; i++) t2.pset(pts[i][0], pts[i][1], 1);
    var hi = GNG.C.bone[6 + shift], mid = GNG.C.bone[5 + shift], lo = GNG.C.bone[4 + shift];
    function on(px, py) {
      return t1.get(px, py) || t2.get(px, py) || t2.get(px - 1, py) || t2.get(px, py - 1) || t2.get(px - 1, py - 1);
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      var lit = !on(x, y - 1) || !on(x - 1, y), shd = !on(x, y + 1) || !on(x + 1, y);
      m.pset(x, y, lit ? hi : (shd ? lo : mid));
    }
    return rimmed(m, BONE_RIM);
  }

  var SK_ART = {
    skull: `
      .566665.
      56777665
      567x66x5
      56xx6xx4
      .5662654
      .5w1w1w.
      ..45554.
    `,
    skullOpen: `
      .566665.
      56777665
      567x66x5
      56xx6xx4
      .5662654
      .5w1w1w.
      ..xxxxx.
      ..45554.
    `,
    torso: `
      ....65...
      566666665
      .5xxx6x5.
      .6666665.
      .5xxx6x4.
      ..66665..
      ....65...
      ....65...
      ..566665.
      ..54..54.
    `,
    foot: `
      65..
      5654
    `,
    boneH: `
      66...66
      .66666.
      .55555.
      55...54
    `,
    boneD1: `
      .66....
      676....
      5666...
      ..665..
      ...6656
      ....555
      ....54.
    `,
    boneV: `
      6..5
      6655
      .65.
      .65.
      .65.
      6655
      6..4
    `,
    boneD2: `
      ....66.
      ....676
      ...6665
      ..665..
      6665...
      565....
      .55....
    `
  };
  var SK = {}, SKF = {};
  (function () {
    for (var n in SK_ART) {
      SK[n] = part(BONE_L, SK_ART[n], 'skel.' + n, BONE_RIM);
      SKF[n] = part(BONE_FAR, SK_ART[n], 'skel.' + n + '_far', BONE_RIM);
    }
  })();
  var THIGH_SHIN = [2, 1];

  /**
   * Pose a skeleton. o = { t:[x,y] torso, s:[x,y] skull, open, armN/armF/legN/legF: joint chains,
   *   footN/footF: [x,y] (default: at the ankle), held:[part,x,y] in the near hand, back:[layers], front:[layers] }
   */
  function skeleton(W, H, o) {
    var layers = (o.back || []).slice();
    function foot(P, leg, at) {
      var a = at || leg[leg.length - 1];
      return [P.foot, a[0], a[1]];
    }
    if (o.armF) layers.push([limb(W, H, o.armF, -2, THIGH_SHIN), 0, 0]);
    if (o.legF) layers.push([limb(W, H, o.legF, -2, THIGH_SHIN), 0, 0], foot(SKF, o.legF, o.footF));
    if (o.t) layers.push([SK.torso, o.t[0], o.t[1]]);
    if (o.legN) layers.push([limb(W, H, o.legN, 0, THIGH_SHIN), 0, 0], foot(SK, o.legN, o.footN));
    if (o.mid) layers = layers.concat(o.mid);
    if (o.s) layers.push([o.open ? SK.skullOpen : SK.skull, o.s[0], o.s[1]]);
    if (o.hat) layers.push([o.hat, o.s[0] - 1, o.s[1] - 3]);
    if (o.held) layers.push(o.held);
    if (o.armN) layers.push([limb(W, H, o.armN, 0, THIGH_SHIN), 0, 0]);
    if (o.front) layers = layers.concat(o.front);
    return compose(W, H, layers);
  }

  (function () {
    var W = 20, H = 28;
    var walk = [
      { t: [5, 9], s: [6, 2],
        legN: [[7, 18], [10, 22], [11, 25]], legF: [[10, 18], [8, 22], [5, 24]], footF: [5, 25],
        armN: [[4, 10], [2, 13], [1, 16]], armF: [[13, 10], [15, 12], [17, 14]] },
      { t: [5, 8], s: [6, 1],
        legN: [[7, 17], [8, 21], [8, 25]], legF: [[10, 17], [12, 20], [10, 24]],
        armN: [[4, 9], [2, 13], [3, 16]], armF: [[13, 9], [15, 13], [15, 16]] },
      { t: [5, 9], s: [6, 2],
        legN: [[7, 18], [5, 22], [2, 24]], footN: [2, 25], legF: [[10, 18], [13, 22], [14, 25]],
        armN: [[4, 10], [6, 14], [10, 15]], armF: [[13, 10], [15, 13], [14, 16]] },
      { t: [5, 8], s: [6, 1],
        legN: [[7, 17], [9, 20], [7, 24]], legF: [[10, 17], [10, 21], [10, 25]],
        armN: [[4, 9], [2, 13], [3, 16]], armF: [[13, 9], [15, 13], [16, 16]] }
    ];
    for (var i = 0; i < 4; i++) reg('skel_walk' + i, skeleton(W, H, walk[i]));
    // throw: coiled wind-up with the bone held high / release: arm whipped forward, jaw open
    reg('skel_throw0', skeleton(W, H, {
      t: [5, 11], s: [6, 4],
      legN: [[7, 20], [5, 23], [3, 25]], legF: [[10, 20], [13, 22], [13, 25]],
      armN: [[4, 12], [1, 9], [2, 6]], armF: [[13, 12], [15, 12], [17, 11]],
      held: [SK.boneV, 1, 1]
    }));
    reg('skel_throw1', skeleton(W, H, {
      t: [7, 9], s: [9, 2], open: true,
      legN: [[9, 18], [6, 22], [3, 24]], footN: [3, 25], legF: [[12, 18], [14, 21], [13, 25]],
      armN: [[6, 10], [12, 12], [17, 14]], armF: [[14, 10], [8, 11], [4, 9]]
    }));
    // rise: skull on a scatter of bones -> crouched, head still hovering -> unfolding
    reg('skel_rise0', skeleton(W, H, {
      back: [[SKF.boneD2, 12, 18], [SK.boneH, 2, 23], [SK.boneH, 11, 23], [SK.boneH, 6, 20]],
      s: [6, 14],
      front: [[SK.foot, 1, 20]]
    }));
    reg('skel_rise1', skeleton(W, H, {
      t: [5, 14], s: [7, 4], open: true,
      legN: [[7, 23], [11, 22], [9, 25]], legF: [[10, 23], [14, 23], [13, 25]],
      armN: [[4, 15], [2, 18], [2, 22]], armF: [[13, 15], [15, 18], [16, 22]]
    }));
    reg('skel_rise2', skeleton(W, H, {
      t: [5, 10], s: [5, 2],
      legN: [[7, 19], [10, 22], [8, 25]], legF: [[10, 19], [13, 22], [12, 25]],
      armN: [[4, 11], [2, 14], [2, 18]], armF: [[13, 11], [15, 14], [16, 18]]
    }));
  })();

  /* ---- skeleton swordsman (28x28): turbaned palace duellist with a scimitar ---- */
  (function () {
    var W = 28, H = 28;
    var SW = mkLegend({ 'ABCD': 'purple:2', 'STU': 'steel:5', 'XY': 'gold:3', J: 'hotred', k: 'outline' });
    var turban = part(SW, `
      ...BCCB...
      .BCDDCCBA.
      BCDCCBCBBA
      ABBCBYJBAA
    `, 'skelsw.turban', { rim: 'purple0' });
    var sash = part(SW, `
      .BCCCBA
      ABCBBA.
      AB.....
      .A.....
      .B.....
    `, 'skelsw.sash', { rim: 'purple0' });
    var sabreD = part(SW, `
      ......U.
      .....UT.
      .....UTS
      ....UTS.
      ...UTS..
      ...UT...
      ..UT....
      .XY.....
      X.......
    `, 'skelsw.sabreD');
    var sabreV = part(SW, `
      ..U.
      .UT.
      .UTS
      .UTS
      .UTS
      .UTS
      .UT.
      .UT.
      .UT.
      .UT.
      XYYX
    `, 'skelsw.sabreV');
    var sabreH = part(SW, `
      X........UU.
      YUUUUUUUUTTU
      YTTTTTTTTSS.
      X....SSSS...
    `, 'skelsw.sabreH');

    // o.b = body offset [dx, dy]; legs given absolutely; arms relative to the body
    function duellist(o) {
      var bx = o.b[0], by = o.b[1];
      function rel(ch) { return ch.map(function (p) { return [p[0] + bx, p[1] + by]; }); }
      return skeleton(W, H, {
        t: [8 + bx, 9 + by], s: [10 + bx + (o.sx | 0), 4 + by + (o.sy | 0)], open: o.open, hat: turban,
        mid: [[sash, 9 + bx, 16 + by]],
        legN: o.lead, legF: o.rear, footN: o.leadFoot, footF: o.rearFoot,
        armN: rel(o.sword), armF: rel(o.off),
        held: [o.blade[0], o.blade[1] + bx, o.blade[2] + by]
      });
    }
    var guardArm = [[16, 10], [19, 13], [21, 11]], offArm = [[7, 10], [4, 8], [5, 4]];
    var walk = [
      { b: [0, 1], lead: [[13, 19], [17, 22], [18, 25]], rear: [[10, 19], [8, 22], [5, 25]] },
      { b: [0, 0], lead: [[13, 18], [16, 22], [17, 25]], rear: [[10, 18], [9, 21], [8, 24]] },
      { b: [0, 0], lead: [[13, 18], [15, 22], [16, 25]], rear: [[10, 18], [10, 22], [9, 25]] },
      { b: [0, 0], lead: [[13, 18], [18, 20], [19, 23]], rear: [[10, 18], [9, 22], [7, 25]] }
    ];
    for (var i = 0; i < 4; i++) {
      walk[i].sword = guardArm; walk[i].off = offArm; walk[i].blade = [sabreD, 20, 4];
      reg('skelsw_walk' + i, duellist(walk[i]));
    }
    reg('skelsw_guard0', duellist({
      b: [-1, 1], sx: -1, lead: [[12, 19], [16, 22], [17, 25]], rear: [[9, 19], [7, 22], [4, 25]],
      sword: [[16, 10], [18, 14], [20, 12]], off: [[7, 10], [4, 12], [3, 15]], blade: [sabreV, 19, 2]
    }));
    reg('skelsw_lunge0', duellist({
      b: [-2, 1], lead: [[11, 19], [15, 22], [16, 25]], rear: [[8, 19], [6, 22], [3, 25]],
      sword: [[16, 10], [13, 13], [16, 13]], off: [[7, 10], [4, 8], [3, 5]], blade: [sabreH, 17, 12]
    }));
    reg('skelsw_lunge1', duellist({
      b: [-4, 3], sx: 1, open: true, lead: [[9, 21], [15, 22], [17, 25]], rear: [[6, 21], [3, 23], [1, 25]],
      sword: [[16, 10], [19, 10], [22, 10]], off: [[7, 10], [4, 11], [2, 13]], blade: [sabreH, 23, 9]
    }));
  })();

  /* ====================================================================== *
   *  4. HAUNTED ARMOUR  (24x32) — a hollow suit: black void, cyan soul-light
   * ====================================================================== */
  (function () {
    var W = 24, H = 32;
    var SPEC = {
      '123456': 'indigo:1',     // plate
      'stuv': 'steel:4',        // trim, blade
      x: 'black',               // the void inside
      c: 'hotcyan', w: 'white', // eyes, soul-gem
      'gh': 'teal:5',           // ghost-light
      k: 'outline'
    };
    var ART = {
      helm: `
        ..34443..
        .3456543.
        345665432
        2sttttuts
        2xxxxxxx2
        2xcwxxcw2
        23454x432
        .3454x43.
        ..33333..
      `,
      torso: `
        ...3xx3...
        .34555543.
        3456655432
        3455555432
        3455545432
        .34554432.
        .23444322.
        .2sttts22.
        3455s54432
        3454s44332
        2343.3322.
      `,
      pauldron: `
        .3443.
        356654
        466554
        355543
        3ssss2
        .2332.
      `,
      leg: `
        .3443..
        .34543.
        .34432.
        .s65s2.
        .34432.
        .34543.
        .34543.
        .34432.
        .33432.
        2345543
        2344ss2
      `,
      legLift: `
        .3443....
        .345543..
        ..345543.
        ...s65s2.
        ...34432.
        ..34543..
        ..34432..
        .2345543.
        .2344ss2.
      `,
      shield: `
        .tuuuut.
        tu4554us
        u455543s
        u455543s
        u45c543s
        u4chc43s
        u4hwh43s
        u4chc43s
        u45c543s
        u455543s
        u455443s
        u445433s
        .u4443s.
        .tu43st.
        ..tsst..
      `,
      armUp: `
        ..v....
        .uvs...
        .uhs...
        .uhs...
        .uhs...
        .uhs...
        .uhs...
        .uhs...
        .uhs...
        ttsst..
        .454...
        .343...
        .3443..
        ..3443.
        ...3443
      `,
      armBack: `
        ...344.
        ..34554
        .343.34
        .454.34
        ttsst.3
        .uhs...
        .uhs...
        .uhs...
        .uhs...
        .uhs...
        .uhs...
        .uvs...
        ..v....
      `,
      armChop: `
        .3443...........
        345543454t......
        .34432343tuu....
        .........tshuuu.
        ...........sshuu
        .............ssv
      `
    };
    var P = {}, F = {}, n;
    for (n in ART) {
      P[n] = part(mkLegend(SPEC), ART[n], 'harmor.' + n);
      F[n] = part(mkLegend(SPEC, -1), ART[n], 'harmor.' + n + '_far');
    }
    var WISP = [decal(mkLegend(SPEC), `
      .h.
      hgh
      .g.
    `, 'harmor.wisp0'), decal(mkLegend(SPEC), `
      h..
      .gh
      .g.
    `, 'harmor.wisp1')];

    // o = { bob, near:[part,dx,dy], far:[part,dx,dy], arm:[part,x,y], shield:[dx,dy], lean, wisp, armFront }
    function suit(o) {
      var b = o.bob | 0, l = o.lean | 0, sh = o.shield || [0, 0];
      var arm = [o.arm[0], o.arm[1], o.arm[2] + b];
      return compose(W, H, [
        [o.far[0], 10 + o.far[1], 20 + o.far[2]],
        [o.near[0], 7 + o.near[1], 20 + o.near[2]],
        o.armFront ? null : arm,
        [P.torso, 7 + l, 11 + b],
        [P.helm, 8 + l, 3 + b],
        [WISP[o.wisp | 0], 11 + l, 0 + b],
        [P.pauldron, 5 + l, 11 + b],
        [P.shield, 15 + sh[0], 10 + b + sh[1]],
        o.armFront ? arm : null
      ]);
    }
    var walk = [
      { bob: 1, near: [P.leg, 2, 0], far: [F.leg, -2, 0], shield: [0, 0], wisp: 0 },
      { bob: 0, near: [P.leg, 0, 0], far: [F.legLift, 0, 0], shield: [0, 1], wisp: 1 },
      { bob: 1, near: [P.leg, -2, 0], far: [F.leg, 2, 0], shield: [0, 0], wisp: 0 },
      { bob: 0, near: [P.legLift, 0, 0], far: [F.leg, 0, 0], shield: [0, 1], wisp: 1 }
    ];
    for (var i = 0; i < 4; i++) {
      walk[i].arm = [P.armUp, 2, 1];
      reg('harmor_walk' + i, suit(walk[i]));
    }
    reg('harmor_slash0', suit({
      bob: 1, near: [P.leg, -2, 0], far: [F.leg, 2, 0], shield: [-1, 1], wisp: 1,
      arm: [P.armBack, 2, 6]
    }));
    reg('harmor_slash1', suit({
      bob: 2, lean: 1, near: [P.leg, 3, 0], far: [F.leg, -3, 0], shield: [-2, 4], wisp: 0,
      arm: [P.armChop, 7, 11], armFront: true
    }));
  })();

  /* ====================================================================== *
   *  PROJECTILES
   * ====================================================================== */
  (function () {
    var b = [SK.boneH, SK.boneD1, SK.boneV, SK.boneD2], at = [[1, 2], [1, 1], [2, 1], [1, 1]];
    for (var i = 0; i < 4; i++) reg('p_bone' + i, compose(9, 9, [[b[i], at[i][0], at[i][1]]]), true);
  })();

  /* ====================================================================== *
   *  5. ZOMBIE LEMMINGS  (12x14, float 16x24) — green mop, blue robe, grave-grey skin
   * ====================================================================== */

  /** Tiny figures: un-rimmed decals [bitmap, x, y] stacked on a canvas, then ONE outline round the lot. */
  function figure(w, h, layers) {
    var b = new Bitmap(w, h);
    for (var i = 0; i < layers.length; i++) if (layers[i]) b.blit(layers[i][0], layers[i][1], layers[i][2]);
    return b.outline(OUTLINE);
  }

  (function () {
    var LEM = mkLegend({
      'GHIJ': 'green:3',        // the famous hair
      '34567': 'zombie:3',      // rotten skin
      'abcd': 'blue:2',         // robe
      x: 'outline', r: 'hotred', w: 'bone6',
      'RST': 'red:3', 'VW': 'bone:5', 'tu': 'steel:3'      // umbrella panels, shaft
    });
    function D(art, n) { return decal(LEM, art, 'lem.' + n); }

    var headSide = D(`
      ..HIIH...
      .HIJJIHH.
      GHIIHH56.
      GGH45xr6.
      .GG445567
      ..G34w4..
    `, 'headSide');
    var headSideUp = D(`
      G.HIIH...
      GHIJJIHH.
      .HIIHH56.
      GGH45xr6.
      .GG445567
      ..G34w4..
    `, 'headSideUp');
    var robe = D(`
      bcdc.
      bcdcb
      abccb
      abcba
    `, 'robe');
    var arms = D(`
      .b445
      cd566
    `, 'arms');
    var legs = [D(`
      ..44.55.
      .43..566
    `, 'legs0'), D(`
      ...45...
      ...556..
    `, 'legs1'), D(`
      ..55.44.
      .56..433
    `, 'legs2'), D(`
      ...54...
      ..5.44..
    `, 'legs3')];

    // walk: 0/2 = contact (body dips, hair settles), 1/3 = passing (hair flicks up)
    for (var i = 0; i < 4; i++) {
      var dip = (i & 1) ? 0 : 1;
      reg('lem_walk' + i, figure(12, 14, [
        [robe, 3, 7 + dip],
        [legs[i], 1, 11],
        [arms, 6, 7 + dip + (i === 1 ? 1 : 0)],
        [(i & 1) ? headSideUp : headSide, 1, 1 + dip]
      ]));
    }

    // BLOCKER: faces you, arms flung wide, feet planted. Frame 1 = blink + impatient foot tap.
    var block = [`
      ...HIIH...
      ..HIJJIH..
      .GHIIIIHG.
      .G5r55r5G.
      .GG5555GG.
      ..G4ww4G..
      7..bccb..5
      76cdccba55
      ...bccb...
      ..abccba..
      ..ab..ba..
      .554..455.
    `, `
      ...HIIH...
      ..HIJJIH..
      .GHIIIIHG.
      .G5355355.
      .GG5555GG.
      ..G4ww4G..
      7..bccb..5
      76cdccba55
      ...bccb...
      ..abccba..
      ..ab..b56.
      .554..44..
    `];
    reg('lem_block0', figure(12, 14, [[D(block[0], 'block0'), 1, 1]]));
    reg('lem_block1', figure(12, 14, [[D(block[1], 'block1'), 1, 1]]));

    // OH NO!: hands clamped on the head, which shakes from side to side
    var ohnoTop = D(`
      65HIIH55
      6HIJJIH5
      cGIIIIGb
      cGr55rGb
      bG5xx5Ga
      b.4xx4.a
    `, 'ohnoTop');
    var ohnoLow = D(`
      bbccba
      .bccb.
      .bccb.
      abccba
      ab..ba
    `, 'ohnoLow');
    var ohnoFeet = D(`
      554..455
    `, 'ohnoFeet');
    for (i = 0; i < 2; i++) {
      reg('lem_ohno' + i, figure(12, 14, [
        [ohnoLow, 3, 7],
        [ohnoFeet, 2, 12],
        [ohnoTop, 1 + i * 2, 1]
      ]));
    }

    // falling: arms up, hair and robe streaming
    reg('lem_fall0', figure(12, 14, [[D(`
      6.H.II.H.5
      6.HIIIIH.5
      c.HIJJIH.b
      cGHIIIIHGb
      cG5r55r5Gb
      .bG5xx5Ga.
      ..b4xx4a..
      ...bccb...
      ..abccba..
      .abc..cba.
      .5......4.
      56......44
    `, 'fall'), 1, 1]]));

    // floater: drifting down under a (moth-eaten) umbrella
    var brolly = [D(`
      ......tt......
      ....STTVWSS...
      ..RSTTVWWVSSR.
      .RSSTVVWWVVSSR
      RSSSTV.WWVVSSR
      RS.RST.VW.VS.R
    `, 'brolly0'), D(`
      ......tt......
      ....STTVWSS...
      ..RSTTVWWVSSR.
      .RSSTVVWWVVSSR
      RSSSTV.WWVVSSR
      R.SRS.TVW.VSR.
    `, 'brolly1')];
    var shaft = D(`
      tu
      tu
      tu
      66
    `, 'shaft');
    var dangle = [D(`
      .4.5.
      .4.5.
      43.56
    `, 'dangle0'), D(`
      4..5..
      4...5.
      43..56
    `, 'dangle1')];
    for (i = 0; i < 2; i++) {
      reg('lem_float' + i, figure(16, 24, [
        [shaft, 7, 6],
        [brolly[i], 1, 1],
        [robe, 5 + i, 16],
        [dangle[i], 5 + i, 20],
        [arms, 8 + i, 17],
        [headSide, 3 + i, 10]
      ]));
    }
  })();

  /* ====================================================================== *
   *  6. MORE PROJECTILES — glowing things get a dark rim of their own colour, solid things the outline
   * ====================================================================== */
  (function () {
    var i;
    function frames(prefix, legend, arts, outlined) {
      for (var n = 0; n < arts.length; n++) {
        var b = GNG.parseArt(legend, arts[n], 'foes_a/' + prefix + n);
        if (outlined) b = b.padded(1).outline(OUTLINE);
        reg(prefix + n, b, true);
      }
    }

    // fireball (10x10): white-hot head, ragged ember tail streaming left
    frames('p_fireball', mkLegend({ 'abc': 'ember:1', d: 'hotorange', e: 'hotyellow', f: 'ember7' }), [`
      ..........
      .....abba.
      ..a.bcddcb
      .abbcdeedc
      abccdeffec
      .abcdeffec
      a.bbcdeedc
      ...abcddcb
      .a...abba.
      ..........
    `, `
      ..........
      .a...abba.
      ...abcddcb
      a.bbcdeedc
      .abcdeffec
      abccdeffec
      .abbcdeedc
      ..a.bcddcb
      .....abba.
      ..........
    `, `
      ..........
      .....abba.
      a..abcddcb
      .abbcdeedc
      ..bcdeffec
      abccdeffec
      .a.bcdeedc
      a..abcddcb
      .....abba.
      ..........
    `]);

    // acid (8x8): a wobbling gob of nukage
    frames('p_acid', mkLegend({ '234567': 'toxic:2', w: 'white' }), [`
      .566..
      56w65.
      567654
      556543
      .5443.
      ..33.4
    `, `
      4.....
      .5665.
      56w665
      567654
      554433
      .4332.
    `], true);

    // cursed skull (11x11) wreathed in purple / toxic flame
    frames('p_skullfire', mkLegend({ '4567': 'bone:4', x: 'outline', w: 'white', 'opqr': 'purple:2', g: 'toxic5', h: 'toxic6' }), [`
      ..o........
      .op..o.o...
      opq.opoqo..
      .pqopq5665.
      opqrq567765
      .oqgr6xx6x5
      opqhg666x65
      .pqgr5w5w5.
      opqrqp555o.
      .opq.opqo..
      ..o...o....
    `, `
      ....o......
      .o.op.o....
      .pooqopqo..
      opq.pq5665.
      .oqrq567765
      opqhr6xx6x5
      .pqgg666x65
      opqrr5w5w5.
      .oqqpq555o.
      ..op.oqpo..
      .o....o....
    `]);

    // coconut (9x9)
    frames('p_coconut', mkLegend({ '123456': 'brown:1', x: 'outline' }), [`
      ..454..
      .45654.
      3456543
      3455443
      23x3x32
      .22x21.
      ..211..
    `], true);

    // banana (9x9): four quarter-turns of a spin
    frames('p_banana', mkLegend({ Y: 'gold7', y: 'hotyellow', g: 'gold4', t: 'brown3' }), [`
      .......
      t.....t
      Yy...yg
      YYyyyyg
      .yyyygg
      ..ggg..
      .......
    `, `
      ..YYyt.
      .YYy...
      .Yy....
      .yy....
      .yyg...
      ..gggt.
      .......
    `, `
      .......
      ..YYY..
      .YYyyy.
      Yyyyyyg
      Yy...yg
      t.....t
      .......
    `, `
      .tYY...
      ...yYy.
      ....yy.
      ....yy.
      ...yyg.
      .tggg..
      .......
    `], true);

    // magic (10x10): a purple orb, pink heart, a sparkle that turns
    frames('p_magic', mkLegend({ '123': 'purple:2', '4': 'purple6', '567': 'pink:5', w: 'white' }), [`
      ....7.....
      ...1221...
      ..12w321..
      .123w4321.
      72wwwww217
      .135w5421.
      .123w3321.
      ..123321..
      ...1221...
      .....7....
    `, `
      ..........
      .7.1221...
      ..w2332w..
      .12w45w21.
      .234w6432.
      .13w56w21.
      .1w3443w1.
      ..123321.7
      ...1221...
      ..........
    `, `
      ..........
      ...1221.7.
      ..123321..
      .1234w321.
      .234www32.
      .1345w421.
      .12344321.
      7.123321..
      ...1221...
      ..........
    `]);

    // plasma bolt (11x5), pointing right
    frames('p_bolt', mkLegend({ a: 'red2', b: 'hotred', c: 'hotorange', e: 'hotyellow', w: 'white' }), [`
      ...aabbba..
      .abbcceecb.
      abcceewwwec
      .abbcceecb.
      ...aabbba..
    `, `
      a...abbba..
      ..abcceecb.
      .abcewwwwec
      a.abcceecb.
      ....abbba..
    `]);
  })();

})();
