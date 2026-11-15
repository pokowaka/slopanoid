/*
 * art_foes_b.js — ENEMY SPRITES, set B (gargoyles, flyers, imps)
 * "Ghosts 'n Goblins: The Cursed PC Gaming Museum"
 *
 *   arremer_*  garg_*   fly0..3 perch0..1 walk0..3 dive0 (32x32)   + garg_statue0 (32x32)
 *   aking_*             fly0..3 perch0..1 walk0..3 dive0 (48x48)   the Red Arremer King
 *   imp_*               walk0..3 throw0..1 (24x28)
 *   crow_perch0 (16x16)  crow_fly0..3 (20x16)  vskull0..3 (16x16)   centre-anchored
 *   ghost0..3 (20x28)    gator0..1 (28x16, centre)
 *
 * All sprites face RIGHT, light comes from the upper-left; anchors are bottom-centre unless noted.
 */
(function () {
  'use strict';
  var GNG = (typeof window !== 'undefined' ? window : globalThis).GNG;

  function P(legend, art, name) { return GNG.parseArt(legend, art, name); }
  function compose(name, w, h, layers, opts) {
    var b = new GNG.Bitmap(w, h);
    for (var i = 0; i < layers.length; i++) {
      var L = layers[i];
      if (!L) continue;
      b.blit(L[0], L[1] | 0, L[2] | 0);
    }
    return GNG.regSprite(name, b, opts);
  }

  /* Bat wings (near/left wing; the far wing is the mirrored copy drawn with a darker legend). */
  var WINGS = {
    up: { x: 0, y: 0, art: `
.k..........
kckk........
.kcck.......
.kppckk.....
..kppcckk...
..knppredk..
.knnrrnrdck.
.krrnnrpdck.
kbmnnnrppdck
.kkmnnrpndck
...kmrpnnndc
...kmrpnnndc
...kmrpnnndc
...krpnnnnnn
..krpnnnmmmm
..krnkkmmmmm
.kbmk.kmmmmm
..kk...kmmmm
........kkkk
` },
    mid: { x: 0, y: 8, art: `
..k.........
.ktkkk......
.kceddkk....
.kccccddk...
kccrppccdk..
kcnrnpppcddd
kcnrnnnppccc
kcnnrnnnnnnn
kcmnrnnnnnnn
kckmrnnnnmmm
kbkkrmnnnmmm
.k..krmnnmmm
....krmkmmmm
....kbk.kmmm
.....k......
` },
    down: { x: 0, y: 13, art: `
.......kk...
.....kkddddd
....kddccccc
.kkkdccppppp
ktcecpppnnnn
.kccpnnnnnnn
kccrnnnnnnnn
kcnrnnnnnnnn
kcnrnnnnnnnn
kcmrnnnnnnnn
kckmrnnnmmmm
kbkkrmnnmk..
.k.kbmmkk...
....kkk.....
` },
    mid2: { x: 0, y: 4, art: `
.....k......
....ktk.....
...kcek.....
...kcdck....
..kcrpdck...
..kcrpdck...
.kcnrppdck..
.kcnrnpdck..
kcnnnrnpdck.
kcnnnrnndccc
kcmnnrnnnnnn
kbkmnrnnnnnn
.k.kmrnnmmmm
....krmkmmmm
....kbk.kmmm
.....k......
` }
  };

  var AR = GNG.makeLegend({
    k: 'outline',
    o: 'red1', a: 'red2', b: 'red3', c: 'red4', d: 'red5', e: 'red6', f: 'red7',
    m: 'maroon1', n: 'maroon2', p: 'maroon3', q: 'maroon4', r: 'red2',
    y: 'hotyellow', w: 'white',
    h: 'bone6', i: 'bone4', j: 'bone2',
    t: 'bone6', s: 'bone3'
  });
  var ARF = GNG.makeLegend({
    k: 'outline',
    o: 'red0', a: 'red1', b: 'red1', c: 'red2', d: 'red3', e: 'red4', f: 'red5',
    m: 'maroon0', n: 'maroon1', p: 'maroon2', q: 'maroon3', r: 'red1',
    y: 'hotyellow', w: 'white',
    h: 'bone5', i: 'bone3', j: 'bone2',
    t: 'bone4', s: 'bone2'
  });

  var FLY_BODY = `
................................
................................
...........k....................
..........khk.........k.........
..........khik.......kik........
...........khik....khik.........
............khikkkkhik..........
............kdeeddccbk..........
............kooddcccok..........
............kayooccoyk..........
............kcyyyooyyk..........
............koddccdccbk.........
............kbwwwwwwwwk.........
..........kkkbowowowok..........
.........kdeeobccccbkkk.........
.........kdfedoooooobcck........
.........kcddbdeedccbobcbk......
.........kbccacdedcbboabcctk....
.........kbcboabbaabak.kkbtk....
.........kabbocddcbak...ktk.....
.........kbcboabbaaak....k......
.........kbcbocddcbak...........
........ktcdcobcddcbbk..........
.........ktktobcdeedcbk.........
..........k.kkaabcddccbk........
.............koaoobcccbk........
.............kaakkbccbk.........
.............kaakbccbk..........
............kabkkbcdccbk........
............ksk.ksktkttk........
.............k...k.k.kk.........
................................
`;

  var TAIL_A = `
...........kk...................
.....k...kkcbk..................
....kckkkccbk...................
...kcdkccbk.....................
.kccddccbk......................
..kkcckkk.......................
....kbk.........................
.....k..........................
`;

  /* Wing folded shut behind the shoulder (perch / statue). */
  var WING_FOLD = `
...k...
..ktk..
..kcek.
.kcdck.
.kcrpdk
.kcrpdk
kcnrpdk
kcnrpdk
kcnrnpk
kcnrnpk
kcmrnpk
kcmrnnk
kbmrnnk
kbkmrnk
.kkmrnk
..kkmmk
...kkk.
`;

  /* The perched body below the jaw (fill only, x = 3, y = 18): knees up, arms planted between them. */
  var PERCH_BODY = `
.....cdd...........dcb.....
....cdeed.........cddcb....
..cddcedobccccccbodcbcdc...
.cdeedcdcobdeedcbobcbcddcb.
cdeeddcbcaocdedcboabccdddcb
cdeddcbbcaoabbaaboabcbcddcb
cddccbbobcaocdcboabcobccdcb
bccbbaoobcaoabbaoabcoabbccb
.bbbao.obcboocdoobcbo.abbb.
.bccbo..bcboaaaaobcb..obcc.
bcddcbo.bcdbooooobcdb.bcdcb
t.t.t...t.t......t.t..t.t.t
`;

  /* Stalking legs, rows 24..30 of the canvas, x = 8. */
  var WALK_LEGS = [`
..k.kkaabcddccbk..
....kaaokobccdcbk.
...kaakk..kbccdbk.
..kaak.....kbccbk.
.kabk.....kbcdccbk
.kstk.....ksktkttk
..kk.......k.k.kk.
`, `
..k.kkaabcddccbk..
.....koaobcccbk...
.....kaakbccbk....
.....kaakbccbk....
....kabkkbcdccbk..
....kskkksktkttk..
.....k...k.k.kk...
`, `
..k.kkaabcddccbk..
.....kbccboaaak...
....kbccbk.kaaak..
...kbccbk...kaak..
..kbcdcbk...kabak.
..ksktkttk..kstsk.
...k.k.kk....k.k..
`, `
..k.kkaabcddccbk..
.....koaoobcccbk..
.....kaakbccdbk...
.....kaakkbcdccbk.
....kabk.ksktkttk.
....kstk..k.k.kk..
.....kk...........
`];

  /* The swoop: torso + trailing legs (fill only), and the two reaching arms. */
  var DIVE_BODY = `
..ts..................
.tbcb.................
..abcba...............
t..aabbaa.............
sbc..aabcbb...........
tcdcb.bcddcb..........
.bcdccbcdeedcb........
..abcdccddeddcbb......
....abbcobcdedccb.....
......aabocddedccb....
........aboabcdedcbb..
.........aabobcddccbb.
...........aabbccccb..
.............aabbbb...
`;
  var DIVE_ARM = `
bcdc.........
.bcddcb......
..abcddcb....
....abcdcb.t.
......abccbtt
........abts.
.........t.s.
`;

  function band(src, y0, y1) {             // rows y0..y1 of a bitmap, same width
    var b = new GNG.Bitmap(src.w, y1 - y0 + 1);
    b.blitPart(src, 0, y0, src.w, y1 - y0 + 1, 0, 0);
    return b;
  }
  /** Stack layers [bitmap, x, y], close the silhouette with the outline colour, register. */
  function frame(name, w, h, layers, post) {
    var b = new GNG.Bitmap(w, h);
    for (var i = 0; i < layers.length; i++) if (layers[i]) b.blit(layers[i][0], layers[i][1] | 0, layers[i][2] | 0);
    rimOpen(b);
    if (post) post(b);
    return GNG.regSprite(name, b);
  }
  /** Outline only where coloured pixels still touch the void (parts that bring their own rim are left alone). */
  function rimOpen(b) {
    var K = GNG.col('outline'), w = b.w, h = b.h, d = b.data, out = new Uint8Array(d), x, y;
    function ink(px, py) {
      if (px < 0 || py < 0 || px >= w || py >= h) return false;
      var c = d[py * w + px];
      return c !== 0 && c !== K;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (!d[y * w + x] && (ink(x - 1, y) || ink(x + 1, y) || ink(x, y - 1) || ink(x, y + 1))) out[y * w + x] = K;
    }
    d.set(out);
    return b;
  }

  /** Weathered stone: a sprinkle of pits and chips, one shade down / up inside the ramp. */
  function weather(b, ramp, seed) {
    var r = GNG.RAMPS[ramp], d = b.data;
    for (var y = 0; y < b.h; y++) for (var x = 0; x < b.w; x++) {
      var c = d[y * b.w + x], j = r.indexOf(c);
      if (j < 2 || j > 6) continue;
      var h = GNG.hash2(x, y, seed);
      if (h < 0.13) d[y * b.w + x] = r[j - 1]; else if (h > 0.95) d[y * b.w + x] = r[j + 1];
    }
    return b;
  }
  /** Moss on upward-facing ledges (the dormant statue). */
  function moss(b, seed, patches) {
    var K = GNG.col('outline'), d = b.data, w = b.w, g = [GNG.col('olive3'), GNG.col('green3'), GNG.col('olive4')];
    var stone = GNG.RAMPS.slate;
    for (var y = 2; y < b.h - 1; y++) for (var x = 0; x < w; x++) {
      var c = d[y * w + x];
      if (stone.indexOf(c) < 0 || d[(y - 1) * w + x] !== K || d[(y - 2) * w + x]) continue;
      var h = GNG.hash2(x >> 2, 1, seed), h2 = GNG.hash2(x, y, seed);
      if (h > 0.5) continue;
      d[y * w + x] = g[1 + ((h2 * 2) | 0)];
      if (h2 < 0.5 && d[(y + 1) * w + x] && d[(y + 1) * w + x] !== K) d[(y + 1) * w + x] = g[0];
    }
    for (var i = 0; patches && i < patches.length; i++) {       // [x, y, shade]: knees, ledges
      var q = patches[i][1] * w + patches[i][0];
      if (stone.indexOf(d[q]) >= 0) d[q] = g[patches[i][2]];
    }
  }

  /**
   * One Arremer flavour. LG / LGF = near / far-side legends.
   * opt: { stone: rampName (weathered), statue: legend with dead eyes (adds <prefix>statue0) }
   */
  function buildArremer(prefix, LG, LGF, opt) {
    opt = opt || {};
    function A(lg, art, n) {
      var b = P(lg, art, prefix + n);
      return opt.stone ? weather(b, opt.stone, 7) : b;
    }
    var body = A(LG, FLY_BODY, 'flybody');
    var wings = [WINGS.up, WINGS.mid, WINGS.down, WINGS.mid2];
    var bob = [1, 0, -1, 0];
    var tail = A(LG, TAIL_A, 'tail');
    var wn = [], wf = [], i;
    for (i = 0; i < 4; i++) {
      var wg = wings[i];
      wn[i] = A(LG, wg.art, 'wingN' + i);
      wf[i] = A(LGF, wg.art, 'wingF' + i).flipH();
      compose(prefix + 'fly' + i, 32, 32, [
        [wf[i], 32 - wg.x - wf[i].w, wg.y],
        [wn[i], wg.x, wg.y],
        [tail, 0, 24],
        [body, 0, bob[i]]
      ]);
    }

    /* ---- perch: squatting on its haunches, wings shut, head sunk between the shoulders ---- */
    function perch(name, lg, lgf, headDy, tailDy, post) {
      var bd = lg === LG ? body : A(lg, FLY_BODY, 'statuebody');
      frame(name, 32, 32, [
        [A(lgf, WING_FOLD, 'foldF').flipH(), 21, 7],
        [A(lg, WING_FOLD, 'foldN'), 4, 7],
        [A(lg, PERCH_BODY, 'perchbody'), 3, 18],
        [band(bd, 0, 13), 0, 6 + headDy]
      ], post);
    }
    perch(prefix + 'perch0', LG, LGF, 0, 0);
    perch(prefix + 'perch1', LG, LGF, 1, 0);
    if (opt.statue) perch(prefix + 'statue0', opt.statue, opt.statue, 1, 0, function (b) {
      moss(b, 11, [[4, 21, 1], [5, 21, 2], [6, 21, 1], [5, 22, 0], [4, 22, 0], [26, 21, 2], [27, 21, 1], [28, 21, 1], [27, 22, 0],
        [2, 27, 1], [3, 27, 2], [3, 28, 0], [13, 26, 1], [14, 26, 2], [13, 27, 0]]);
    });

    /* ---- walk: stalking on the ground, wings half-folded ---- */
    var upper = band(body, 0, 23);
    for (i = 0; i < 4; i++) {
      var dip = (i & 1) ? 0 : 1;
      frame(prefix + 'walk' + i, 32, 32, [
        [wf[3], 19, 8 + dip],
        [wn[3], 1, 8 + dip],
        [tail, 0, 24 - (i & 1)],
        [A(LG, WALK_LEGS[i], 'legs' + i), 8, 24],
        [upper, 0, dip]
      ]);
    }

    /* ---- dive: head and claws first, wings swept back ---- */
    frame(prefix + 'dive0', 32, 32, [
      [A(LGF, WINGS.up.art, 'sweepF'), 12, 0],
      [A(LGF, DIVE_ARM, 'diveArmF'), 18, 17],
      [A(LG, TAIL_A, 'tailD'), 0, 15],
      [A(LG, DIVE_BODY, 'divebody'), 1, 7],
      [wn[0], 6, 1],
      [band(body, 2, 13), 5, 11],
      [A(LG, DIVE_ARM, 'diveArmN'), 16, 21]
    ]);
  }
  buildArremer('arremer_', AR, ARF);

  /* ---- stone gargoyle: the same beast in weathered slate, eyes like coals ---- */
  var GARG = {
    k: 'outline',
    o: 'slate1', a: 'slate2', b: 'slate3', c: 'slate4', d: 'slate5', e: 'slate6', f: 'slate7',
    m: 'slate0', n: 'slate1', p: 'slate2', q: 'slate3', r: 'slate2',
    y: 'hotorange', w: 'mist6',
    h: 'mist6', i: 'mist4', j: 'mist2',
    t: 'mist6', s: 'mist3'
  };
  var GARGF = {
    k: 'outline',
    o: 'slate0', a: 'slate1', b: 'slate1', c: 'slate2', d: 'slate3', e: 'slate4', f: 'slate5',
    m: 'slate0', n: 'slate0', p: 'slate1', q: 'slate2', r: 'slate1',
    y: 'hotorange', w: 'mist6',
    h: 'mist5', i: 'mist3', j: 'mist2',
    t: 'mist4', s: 'mist2'
  };
  function withKeys(base, over) {
    var o = {}, k;
    for (k in base) o[k] = base[k];
    for (k in over) o[k] = over[k];
    return GNG.makeLegend(o);
  }
  buildArremer('garg_', GNG.makeLegend(GARG), GNG.makeLegend(GARGF), {
    stone: 'slate',
    statue: withKeys(GARG, { y: 'slate1', w: 'mist4' })
  });

  /* ====================================================================== *
   *  RED ARREMER KING (48x48) — the stage-5 boss. Drawn at its own resolution: crowned, gold-braced,
   *  deep crimson, with great dusk-purple wings (those are built from their bones, see batWing).
   * ====================================================================== */
  var KING = {
    k: 'outline',
    o: 'dusk1', a: 'red1', b: 'red2', c: 'red3', d: 'red4', e: 'red5', f: 'red6',
    m: 'dusk1', n: 'dusk2', p: 'dusk3', q: 'dusk4', r: 'red2',
    y: 'hotyellow', W: 'white', w: 'white',
    h: 'bone6', i: 'bone4', u: 'bone2',
    t: 'bone6', s: 'bone3',
    G: 'gold6', g: 'gold4', J: 'gold2', Y: 'hotyellow', R: 'hotcyan'
  };
  var KINGF = {
    k: 'outline',
    o: 'dusk0', a: 'red0', b: 'red1', c: 'red2', d: 'red3', e: 'red4', f: 'red5',
    m: 'dusk0', n: 'dusk1', p: 'dusk2', q: 'dusk3', r: 'red1',
    y: 'hotyellow', W: 'white', w: 'bone6',
    h: 'bone5', i: 'bone3', u: 'bone2',
    t: 'bone4', s: 'bone2',
    G: 'gold5', g: 'gold3', J: 'gold1', Y: 'gold6', R: 'teal5'
  };

  var K_HEAD = `
.deeeedddcccb.
deffeeddddcccb
dooodddccboooc
dayyoodccooyyb
dcyWyyoooyyWyb
dcoyyyobboyyob
cdcoooddcooocb
cddccdoodccccb
cbwwwwwwwwwwwb
.bwowwowwowwb.
..owowwowwob..
..bbccddccbb..
`;
  var K_HORN = `
h.....
hi....
hhi...
hhiu..
.hhiu.
.hhhiu
..hhiu
...hhi
...hii
....iu
`;
  var K_CROWN = `
Y....Y....Y
G...gGg...g
Gg.gGGGg.gJ
GGgGGRGGgGJ
GgGgGGGgGgJ
JggggggggJJ
`;
  var K_ARM = `
.cddc.
cdeedc
deffdc
cdeedb
cdddcb
bcccba
.bccb.
GGgGgJ
GgGGgJ
gGggJJ
bcccba
cddcbb
t.t.t.
`;
  var K_ARM_OUT = `
bccbb......
obccdcb....
.obccdcb...
..oabcGGgJ.
...oabGgGgJ
....oagGgJJ
.....obccbt
......obctt
.......t.t.
`;
  var K_CHEST = `
.bccccccccbb.
bdeeedobdddcb
cdeffdobdeedb
cdeeddobddddb
bcdddcobcdccb
obbbbboobbbbo
.ocdecobcdco.
.oabbaooabao.
.ocdecobcdco.
.oabbaooabao.
.bcddccbcdcb.
bcdeedccddccb
`;
  var K_LEGS = `
.aabbcdddccb..
.aabbobccdccb.
..aabo.bccdcb.
..aab..bccdcb.
..aab..bccdb..
.aabb.bccdb...
.abbb.bcddccb.
aabcbbbcdddccb
s.t.t.t.t.t.tt
`;
  var K_WALK = [`
......aabbcdddccb.....
....aaabbo.obccddcb...
...aabbo....obccdcb...
..aabbo......bccdcb...
.aabb........bccdcb...
.aabb........bccddb...
.abbb.......bccddccb..
aabcbb......bcdddccbb.
s.t.t.......t.t.t.t.tt
`, `
......aabbcdddccb.....
......aabbobccdccb....
.......aabobccdcb.....
.......aab.bccdcb.....
.......aab.bccdb......
......aabbbccdb.......
......abbbbcddccb.....
.....aabcbbcdddccb....
.....s.t.t.t.t.t.tt...
`, `
......aabbcdddccb.....
.....bccddbo.aabbb....
....bccdcbo...aabbb...
...bccdcb......aabb...
..bccdcb.......aabb...
..bccdb........aabb...
.bccddccb......abbbb..
.bcdddccbb....aabcbbb.
.t.t.t.t.tt...s.t.t.t.
`, `
......aabbcdddccb.....
......aabbobccdccb....
.......aabobccddcb....
.......aab.bccddccb...
.......aab..bcdddccb..
......aabb..t.t.t.tt..
......abbb............
.....aabcb............
.....s.t.t............
`];
  var K_TAIL = `
............cb.
.....c....ccbb.
....cdc.cccbb..
...cddcccbb....
.ccdddccbb.....
cccddccb.......
...ccdc........
....cb.........
`;
  var K_PERCH = [
    ['.......c', 'ddd..', '.', '.......', '.', '..ddc', 'b.......'],
    ['......cd', 'eeed.', '.', '.......', '.', '.cddd', 'cb......'],
    ['......cd', 'ffedc', 'o', 'bcccccb', 'o', 'cdddc', 'cb......'],
    ['...cddcd', 'eeddc', 'o', 'deeeddc', 'o', 'bcddc', 'bcddc...'],
    ['..cdeedc', 'ddccb', 'o', 'deefedc', 'o', 'bccdc', 'bcdddc..'],
    ['.cdeeedc', 'bccba', 'o', 'cdeedcb', 'o', 'abccb', 'ccddddc.'],
    ['cdeeeddc', 'bccba', 'o', 'abbbbaa', 'o', 'abccb', 'bcdddddc'],
    ['cdeedddc', 'bbcba', 'o', 'ocddcbo', 'o', 'abcbb', 'bcddddcb'],
    ['cdedddcb', 'GGgGJ', 'o', 'oabbbao', 'o', 'GGgGJ', 'bccdddcb'],
    ['cddddccb', 'GgGgJ', 'o', 'ocddcbo', 'o', 'GgGgJ', 'bbccdccb'],
    ['bcdccbbo', 'gGgJJ', 'o', 'oabbbao', 'o', 'gGgJJ', 'obbccbba'],
    ['bccbbao.', 'bccba', 'o', 'oocdcoo', 'o', 'bccba', '.oabbbba'],
    ['.bbbao..', 'bccba', 'o', 'ooaaaoo', 'o', 'bccba', '..oabbb.'],
    ['.bccbo..', 'bcdcb', 'o', 'ooooooo', 'o', 'bcdcb', '..obccb.'],
    ['bcdddcb.', 'cdddc', 'b', 'ooooooo', 'b', 'cdddc', '.bcdddcb'],
    ['bcdddccb', 'cddcb', 'b', '.ooooo.', 'b', 'cddcb', 'bccdddcb'],
    ['t.t.t.t.', 't.t.t', '.', '.......', '.', 't.t.t', '.t.t.t.t']
  ].map(function (r) { return r.join(''); });
  var K_DIVE = `
...t.s........................
..tbcb........................
..bcdcb.......................
...abccba.....................
....aabbcba...................
t....aabbbaa..................
sbcb..aaabcbb.................
tcddcb.aabcdcbb...............
.bcddccb.bcdddcb..............
..bcdddccbcdeeddcb............
...abcdddccddeeeddcb..........
.....abccddcddefeddcbb........
.......abbccobcdeeedccb.......
.........aabbocddeeddccb......
...........aabobcdeeedccb.....
.............abobbcdeedccbb...
..............aabobcddddccbb..
................aabbccccccbb..
..................aabbbbbb....
`;
  var K_DIVE_ARM = `
bcddc............
.bcdddcb.........
..abcdddcb.......
....abcGGgJ......
......aGgGgJ.....
........gGgJcb.t.
..........bccbtt.
...........abbts.
............t.s..
`;

  /**
   * A bat wing built from its skeleton, on a canvas-sized bitmap (left / near wing; mirror it for the far one).
   * o = { s: shoulder, w: wrist, t: wing tip, f: [finger tips...], r: where the membrane rejoins the body,
   *       claw: [dx, dy] }  — all [x, y] canvas points. Membrane panels hang scalloped between the finger tips.
   */
  function batWing(W, H, o, L) {
    var mask = new GNG.Bitmap(W, H), b = new GNG.Bitmap(W, H), i, x, y;
    var tips = [o.t].concat(o.f, [o.r]);
    var x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (i = 0; i + 1 < tips.length; i++) {
      var A = tips[i], B = tips[i + 1], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      var cx = mx + (o.w[0] - mx) * 0.36, cy = my + (o.w[1] - my) * 0.36;
      var poly = [o.w, A];
      for (var n = 1; n < 6; n++) {
        var u = n / 6, v = 1 - u;
        poly.push([v * v * A[0] + 2 * u * v * cx + u * u * B[0], v * v * A[1] + 2 * u * v * cy + u * u * B[1]]);
      }
      poly.push(B);
      if (i === tips.length - 2) poly.push(o.s);
      mask.poly(poly, i + 1);
    }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (mask.data[y * W + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    // membrane: lit towards the upper-left, sunk in shadow towards the body; panels alternate a little
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      var pn = mask.data[y * W + x];
      if (!pn) continue;
      var sh = ((x - x0) / (x1 - x0 + 1) + (y - y0) / (y1 - y0 + 1)) * 0.5 + ((pn & 1) ? 0 : 0.1);
      b.data[y * W + x] = sh < 0.34 ? L.p : (sh < 0.74 ? L.n : L.m);
    }
    function bone(A, B, thick) {
      var steep = Math.abs(B[1] - A[1]) > Math.abs(B[0] - A[0]);
      if (thick) b.line(A[0] + (steep ? 1 : 0), A[1] + (steep ? 0 : 1), B[0] + (steep ? 1 : 0), B[1] + (steep ? 0 : 1), L.c);
      b.line(A[0], A[1], B[0], B[1], thick ? L.d : L.c);
    }
    for (i = 0; i < o.f.length; i++) b.line(o.w[0], o.w[1], o.f[i][0], o.f[i][1], L.r);
    bone(o.w, o.t, false);
    bone(o.s, o.w, true);
    var cl = o.claw || [-1, -1];
    b.pset(o.w[0], o.w[1], L.e);
    b.pset(o.w[0] + cl[0], o.w[1] + cl[1], L.t);
    b.pset(o.w[0] + cl[0] * 2, o.w[1] + cl[1] * 2, L.t);
    b.pset(o.t[0], o.t[1], L.b);
    for (i = 0; i < o.f.length; i++) b.pset(o.f[i][0], o.f[i][1], L.b);
    return b.outline(L.k);
  }

  (function () {
    var W = 48, H = 48, L = GNG.makeLegend(KING), LF = GNG.makeLegend(KINGF);
    function A(art, n) { return P(L, art, 'aking.' + n); }
    var head = A(K_HEAD, 'head'), crown = A(K_CROWN, 'crown');
    var hornN = A(K_HORN, 'hornN'), hornF = P(LF, K_HORN, 'aking.hornF').flipH();
    var armN = A(K_ARM, 'arm'), armOut = A(K_ARM_OUT, 'armOut'), chest = A(K_CHEST, 'chest');
    var legs = A(K_LEGS, 'legs'), tail = A(K_TAIL, 'tail');

    var POSE = {
      up: { s: [18, 27], w: [10, 13], t: [3, 2], f: [[2, 15], [5, 26]], r: [15, 33] },
      mid: { s: [18, 27], w: [8, 19], t: [2, 11], f: [[2, 24], [7, 32]], r: [15, 34] },
      down: { s: [18, 27], w: [8, 28], t: [2, 37], f: [[7, 43], [13, 41]], r: [16, 36], claw: [-1, -1] },
      mid2: { s: [18, 27], w: [11, 15], t: [6, 5], f: [[4, 18], [7, 28]], r: [15, 33] },
      fold: { s: [16, 31], w: [10, 15], t: [7, 35], f: [[10, 38]], r: [14, 37], claw: [0, -1] },
      half: { s: [18, 27], w: [11, 16], t: [4, 25], f: [[6, 33]], r: [14, 34], claw: [0, -1] },
      swept: { s: [22, 29], w: [13, 15], t: [4, 3], f: [[3, 13], [8, 22]], r: [16, 27] }
    };
    function wingPair(pose, dy) {
      var o = POSE[pose], q = { claw: o.claw, f: [] }, k;
      function sh(pt) { return [pt[0], pt[1] + (dy | 0)]; }
      q.s = sh(o.s); q.w = sh(o.w); q.t = sh(o.t); q.r = sh(o.r);
      for (k = 0; k < o.f.length; k++) q.f.push(sh(o.f[k]));
      return [[batWing(W, H, q, LF).flipH(), 0, 0], [batWing(W, H, q, L), 0, 0]];
    }
    /** head + horns + crown, (x, y) = top-left of the face */
    function headAt(x, y) {
      return [[hornF, x + 14, y - 9], [hornN, x - 6, y - 9], [head, x, y], [crown, x + 2, y - 6]];
    }
    /** the standing / flying upper body, dy = bob */
    function upper(dy) {
      return [[armOut, 31, 28 + dy], [armN, 11, 27 + dy], [chest, 18, 27 + dy]].concat(headAt(17, 16 + dy));
    }

    var wings = ['up', 'mid', 'down', 'mid2'], bob = [1, 0, -1, 0], i;
    for (i = 0; i < 4; i++) {
      var dy = bob[i] - 1;
      frame('aking_fly' + i, W, H, wingPair(wings[i], 0).concat(
        [[tail, 4, 37 + dy], [legs, 18, 38 + dy]], upper(dy)));
    }
    for (i = 0; i < 4; i++) {
      var dip = (i & 1) ? 0 : 1;
      frame('aking_walk' + i, W, H, wingPair('half', dip).concat(
        [[tail, 4, 37 - (i & 1)], [A(K_WALK[i], 'walk' + i), 14, 38]], upper(dip)));
    }
    var perchBody = A(K_PERCH, 'perch');
    for (i = 0; i < 2; i++) {
      frame('aking_perch' + i, W, H, wingPair('fold', 0).concat([[perchBody, 7, 30]], headAt(17, 22 + i)));
    }
    frame('aking_dive0', W, H, [
      [batWing(W, H, { s: [30, 26], w: [22, 12], t: [14, 1], f: [[12, 10], [17, 18]], r: [24, 24] }, LF), 0, 0],
      [P(LF, K_DIVE_ARM, 'aking.diveArmF'), 30, 27],
      [tail, 1, 24],
      [A(K_DIVE, 'dive'), 4, 11],
      [batWing(W, H, POSE.swept, L), 0, 0]
    ].concat(headAt(25, 21), [[A(K_DIVE_ARM, 'diveArmN'), 26, 32]]));
  })();

  /* ====================================================================== *
   *  PAPER-DOLL KIT for the smaller foes: fill-only parts, each with its own 1px rim. A rim is the
   *  hard outline on the silhouette and a dark shade of the part's own colour inside the figure.
   * ====================================================================== */
  var OUTLINE = GNG.col('outline');
  var RIM_COLOUR = [0], RIM_CODE = {};
  function rimCode(name) {
    if (!RIM_CODE[name]) { RIM_COLOUR.push(GNG.col(name)); RIM_CODE[name] = RIM_COLOUR.length - 1; }
    return RIM_CODE[name];
  }
  /** { 'abc': 'brown:2', x: 'outline' } -> legend; shift darkens (-1) the ramps for far-side limbs. */
  function mkLegend(spec, shift) {
    var o = {}, key, i;
    shift = shift | 0;
    for (key in spec) {
      var v = spec[key], m = /^([a-z]+):(\d)$/.exec(v);
      for (i = 0; i < key.length; i++) o[key.charAt(i)] = m ? (m[1] + GNG.clamp(+m[2] + i + shift, 0, 7)) : v;
    }
    return GNG.makeLegend(o);
  }
  function part(legend, art, name, rim) {
    var p = P(legend, art, 'foes_b/' + name).padded(1);
    p.outline(rim ? rimCode(rim) : OUTLINE);
    p.ox = 1; p.oy = 1;
    return p;
  }
  function decal(legend, art, name) {
    var p = P(legend, art, 'foes_b/' + name);
    p.ox = 0; p.oy = 0;
    return p;
  }
  function doll(w, h, layers) {
    var b = new GNG.Bitmap(w, h), i, x, y, c, d = b.data;
    for (i = 0; i < layers.length; i++) {
      var l = layers[i];
      if (l) b.blit(l[0], l[1] - l[0].ox, l[2] - l[0].oy);
    }
    var out = new Uint8Array(d);
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
  function reg(name, bmp, centre) {
    return GNG.regSprite(name, bmp, centre ? { ax: bmp.w >> 1, ay: bmp.h >> 1 } : { ax: bmp.w >> 1, ay: bmp.h });
  }
  /** Parts table: every art as a near-side part and a (darker) '_far' twin. */
  function kit(id, spec, arts, rims) {
    var K = {}, n;
    for (n in arts) {
      K[n] = part(mkLegend(spec), arts[n], id + '.' + n, rims && rims[n]);
      K[n + '_far'] = part(mkLegend(spec, -1), arts[n], id + '.' + n + '_far', rims && rims[n]);
    }
    return K;
  }

  /* ====================================================================== *
   *  CYBER-IMP (24x28): spiky brown hell-spawn with a servo arm, a brow visor and a chest core
   * ====================================================================== */
  (function () {
    var W = 24, H = 28;
    var SPEC = {
      '1234567': 'brown:1',     // hide
      'STUV': 'steel:3',        // cybernetics
      w: 'bone6', v: 'bone4',   // spikes, claws, teeth
      r: 'hotred', c: 'hotcyan', C: 'white', x: 'outline'
    };
    var ART = {
      head: `
        ..w.4564..
        .w45677654
        w.45676665
        .4TUUUUTS.
        .4ScCSxrx.
        .345554456
        ..3xwxwxw.
        ..23xxxx4.
        ...23443..
      `,
      headRoar: `
        ..w.4564..
        .w45677654
        w.45676665
        .4TUUUUTS.
        .4ScCSxrx.
        .345554456
        ..3xwxwxw.
        ..3xxxxxx.
        ..23xwxw4.
        ...23443..
      `,
      torso: `
        ..45675....
        .4567765543
        45676555543
        456655Sc443
        3556545S432
        .345544432.
        .34554433..
        ..3544332..
        ..2443322..
        ..233.222..
      `,
      spikeA: `
        w..
        ww.
        .wv
      `,
      spikeB: `
        .w.
        .wv
        wwv
      `,
      armHang: `
        .TUT.
        TUVUS
        STUTS
        .TUS.
        wTcT.
        .STUS
        ..TUS
        ..TUS
        .VTUV
        .V.V.
      `,
      armUp: `
        V.V..
        VTUV.
        .TUS.
        .TUS.
        .TcT.
        ..TUS
        ..TUS
        .TUVU
        ..TUT
      `,
      armOut: `
        .TUT......V
        TUVUUUcUUTV
        STUTSSTSSTV
        .SS.......V
      `,
      armFar: `
        455.....
        4554444.
        .44.4554
        .....45w
        .....w.w
      `,
      armFarBack: `
        ...554
        ..4554
        .454..
        w54...
        .w....
      `,
      legPass: `
        5554..
        55543.
        .5543.
        .4543.
        ..443.
        ..454.
        ..454.
        ..343.
        ..4554
        ..454w
      `,
      legFwd: `
        5554....
        45554...
        .4554...
        .45543..
        ..4543..
        ..4543..
        ...454..
        ...4554w
        ...44w.w
      `,
      legBack: `
        ....5554
        ...45554
        ...4554.
        ..4554..
        ..454...
        .454....
        .343....
        454.....
        4554w...
      `,
      legLift: `
        5554...
        45554..
        .45543.
        .45543.
        .4554..
        4554...
        454....
        45w....
        4w.....
      `
    };
    var RIM = 'brown1';
    var K = kit('imp', SPEC, ART, { head: RIM, headRoar: RIM, torso: RIM, armFar: RIM, armFarBack: RIM,
      legPass: RIM, legFwd: RIM, legBack: RIM, legLift: RIM, armHang: 'steel1', armUp: 'steel1', armOut: 'steel1' });
    var FIRE = mkLegend({ 'abc': 'ember:1', d: 'hotorange', e: 'hotyellow', f: 'ember7' });
    var orb = [decal(FIRE, `
      ...a.b.
      ..abcb.
      .bcddcb
      acdefdc
      bcdeedb
      .bcddc.
      ..bcb..
    `, 'imp.orb0'), decal(FIRE, `
      .b.....
      ..cb.a.
      .bcdcb.
      bcdeedc
      acdfedb
      .bcddc.
      ..bcb..
    `, 'imp.orb1')];

    var walk = [
      { bob: 1, near: [K.legFwd, 8], far: [K.legBack_far, 5], arm: 9 },
      { bob: 0, near: [K.legPass, 8], far: [K.legLift_far, 9], arm: 8 },
      { bob: 1, near: [K.legBack, 4], far: [K.legFwd_far, 9], arm: 7 },
      { bob: 0, near: [K.legLift, 8], far: [K.legPass_far, 9], arm: 8 }
    ];
    for (var i = 0; i < 4; i++) {
      var f = walk[i], b = f.bob;
      reg('imp_walk' + i, doll(W, H, [
        [K.armFar_far, 13, 11 + b],
        [f.far[0], f.far[1], 17 + b],
        [f.near[0], f.near[1], 17 + b],
        [K.torso, 5, 8 + b],
        [K.spikeA, 4, 6 + b], [K.spikeB, 8, 5 + b],
        [K.head, 10, 2 + b],
        [K.armHang, f.arm, 10 + b]
      ]));
    }
    // throw0: coiled back, fireball cupped high in the servo claw / throw1: lunge, arm rammed forward
    var t0 = doll(W, H, [
      [K.armFar_far, 12, 12],
      [K.legBack_far, 4, 18],
      [K.legFwd, 8, 18],
      [K.torso, 4, 9],
      [K.spikeA, 3, 8], [K.spikeB, 7, 6],
      [K.head, 9, 3],
      [K.armUp, 4, 3]
    ]);
    t0.blit(orb[0], 1, 1);
    reg('imp_throw0', t0);
    var t1 = doll(W, H, [
      [K.armFarBack_far, 2, 12],
      [K.legBack_far, 3, 18],
      [K.legFwd, 9, 18],
      [K.torso, 6, 9],
      [K.spikeA, 5, 7], [K.spikeB, 9, 6],
      [K.headRoar, 11, 3],
      [K.armOut, 10, 11]
    ]);
    reg('imp_throw1', t1);
  })();

  /* ====================================================================== *
   *  CROW: blue-black, red-eyed
   * ====================================================================== */
  (function () {
    var CR = mkLegend({ '1234567': 'night:1', 'bB': 'tan:3', L: 'slate5', r: 'hotred', x: 'outline' });
    var CRF = mkLegend({ '1234567': 'night:0', 'bB': 'tan:3', L: 'slate5', r: 'hotred', x: 'outline' });
    reg('crow_perch0', doll(16, 16, [[part(CR, `
      .......4565...
      ......456676..
      ......45r566BB
      ......4555655b
      .....44555554.
      ....3445565...
      ...33455665...
      ..334455554...
      .2334455544...
      12233444443...
      .122.3443.....
      ..1...L.L.....
      .....LL.LL....
    `, 'crow.perch'), 1, 2]]), true);

    var body = `
      ............4565..
      ...........45r66BB
      .2233344455555665b
      1223334445555554..
      ..12233444554.....
    `;
    var wing = {
      up: `
        56.......
        5665.....
        566665...
        .5666665.
        .45666665
        ..4566665
        ...455555
      `,
      mid: `
        .566.....
        56666655.
        .45666665
        ...455555
      `,
      low: `
        ...455555
        .45666665
        56666655.
        .566.....
      `,
      down: `
        ...455555
        ..4566665
        .45666665
        .5666665.
        566665...
        5665.....
        56.......
      `
    };
    var WN = mkLegend({ '1234567': 'night:2' });        // the near wing catches the light
    // [wing, near x, y, far x, y (null = hidden), body dy]
    var cyc = [['up', 3, 0, 7, 1, 1], ['mid', 2, 3, null, 0, 0], ['down', 3, 8, 7, 8, -1], ['low', 2, 7, null, 0, 0]];
    for (var i = 0; i < 4; i++) {
      var c = cyc[i];
      reg('crow_fly' + i, doll(20, 16, [
        c[3] === null ? null : [part(CRF, wing[c[0]], 'crow.wingF' + i), c[3], c[4] + c[5]],
        [part(CR, body, 'crow.body'), 1, 5 + c[5]],
        [part(WN, wing[c[0]], 'crow.wingN' + i), c[1], c[2] + c[5]]
      ]), true);
    }
  })();

  /* ====================================================================== *
   *  VOODOO SKULL (16x16): top hat, feathers, chattering jaw, green-purple flame
   * ====================================================================== */
  (function () {
    var VS = mkLegend({
      '34567': 'bone:3', x: 'outline', g: 'hotgreen',
      'hH': 'purple:2', R: 'red4', 'tT': 'teal:4', y: 'hotyellow', o: 'orange4',
      'pq': 'purple:3', 'ef': 'toxic:4'
    });
    var skull = part(VS, `
      .5666665.
      567777665
      56xx76xx5
      56gx66gx4
      .5665x654
      .56666654
      ..w5w5w5.
    `.replace(/w/g, '7'), 'vskull.skull');
    var jaw = part(VS, `
      575757.
      .55554.
    `, 'vskull.jaw');
    var hat = part(VS, `
      .hHHHh.
      .RRRRR.
      hhHHHhh
    `, 'vskull.hat');
    var feather = part(VS, `
      t..
      Tt.
      .To
      ..y
    `, 'vskull.feather');
    var flames = [`
      ...e....
      ..ef.p..
      .pfe.q..
      .qeqp...
      pqfpq...
      .pqeqp..
      ..pqp...
      ...p....
    `, `
      ..p.....
      ..qe.e..
      .peq.fp.
      .qfep...
      .pqfq...
      pqeqp...
      .pqp....
      ..p.....
    `, `
      ....e...
      .p.ef...
      .q.fqp..
      pqeqp...
      .qfeq...
      .pqfqp..
      ..pqp...
      ..p.....
    `, `
      .e......
      .fp..p..
      .eq.eq..
      pqfqfp..
      .pqeq...
      ..qfqp..
      .pqp....
      ...p....
    `];
    var chatter = [0, 1, 2, 1];
    for (var i = 0; i < 4; i++) {
      reg('vskull' + i, doll(16, 16, [
        [part(VS, flames[i], 'vskull.flame' + i, 'purple1'), 1, 6],
        [jaw, 6, 11 + chatter[i]],
        [skull, 5, 4],
        [feather, 3, 2 - (i & 1)],
        [hat, 6, 1]
      ]), true);
    }
  })();

  /* ====================================================================== *
   *  GHOST BUCCANEER (20x28): all ectoplasm (the game stipples it)
   * ====================================================================== */
  (function () {
    var GH = mkLegend({ '1234567': 'teal:1', x: 'teal0', w: 'white' });
    var RIM = 'teal2';
    function G(art, n) { return part(GH, art, 'ghost.' + n, RIM); }
    var hat = G(`
      3....455....3
      43.3456654.34
      5444566w65445
      .45556w6w554.
      ..234444432..
    `, 'hat');
    var head = G(`
      .5666665
      56777766
      5xx67xx6
      5xx66xx5
      .56x6654
      .5w5w5w.
      ..5554..
    `, 'head');
    var coat = G(`
      ..455554..
      .45666554.
      456w665543
      4566w65543
      45665w5443
      .456655w43
      .45565544.
      .45565544.
    `, 'coat');
    var arm = G(`
      ........w
      .......w7
      ......w76
      ......w7.
      .....w76.
      .....w7..
      ....w76..
      ...6776..
      ..6.55...
      556655...
      4555.....
    `, 'arm');
    var hook = G(`
      .45
      .45
      .5.
      7.7
      .7.
    `, 'hook');
    var tails = [G(`
      .45565544.
      .45565443.
      ..4556443.
      ..455443..
      ...4544...
      ...4543...
      ....443...
      ...34.....
      ..3.......
    `, 'tail0'), G(`
      .45565544.
      .45565443.
      .4556443..
      ..45443...
      ..4544....
      ...4543...
      ....4433..
      ......33..
      .......3..
    `, 'tail1'), G(`
      .45565544.
      ..4556443.
      ..4556443.
      ...45544..
      ...45443..
      ....4543..
      ....443...
      ...343....
      ...3......
    `, 'tail2'), G(`
      .45565544.
      .45565443.
      ..455644..
      .4554443..
      .45443....
      ..4543....
      ...4433...
      .....33...
      ....3.....
    `, 'tail3')];
    var lift = [0, 0, 1, 0];
    for (var i = 0; i < 4; i++) {
      reg('ghost' + i, doll(20, 28, [
        [hook, 1, 13 + lift[i]],
        [tails[i], 3, 18],
        [coat, 3, 10],
        [head, 5, 5],
        [hat, 2, 1],
        [arm, 10, 3 - lift[i]]
      ]));
    }
  })();

  /* ====================================================================== *
   *  MOAT GATOR (28x16): frame 0 jaws shut, frame 1 jaws agape
   * ====================================================================== */
  (function () {
    var GA = mkLegend({
      '123456': 'green:1', T: 'toxic5', 'pqs': 'olive:5',
      w: 'white', m: 'maroon2', M: 'red3', y: 'hotyellow', x: 'outline'
    });
    reg('gator0', doll(28, 16, [[part(GA, `
      ..........................
      ................T.yx5.....
      ...........T.T.4565566655.
      ........T.T4545555555556x5
      ......T.455555554444555555
      ....4.45555544444wpwpwpwp.
      ...3444444444333qqqqqqqs..
      ..334444333333qqqqqsss....
      .2333333qqqqqqqsss........
      .22333223.pq.44...........
      122222...4w4..4w4.........
      1122......w.w..w.w........
      .11.......................
    `, 'gator0'), 1, 1]]), true);
    reg('gator1', doll(28, 16, [[part(GA, `
      .....................456..
      ...................45565x.
      ................T45566ww..
      ...........T.T.yx56wwMw...
      ........T.T454555MMMmm....
      ......T.45555555MMmm......
      ....4.455555444mMMMmmw.w..
      ...34444444443qqqmMwqwqsw.
      ..33444433333qqqqqqqqsss..
      .2333333qqqqqqqsss........
      .22333223.pq.44...........
      122222...4w4..4w4.........
      1122......w.w..w.w........
      .11.......................
    `, 'gator1'), 1, 1]]), true);
  })();

})();
