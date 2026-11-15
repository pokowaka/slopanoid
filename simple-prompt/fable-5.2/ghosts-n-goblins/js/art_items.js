/*
 * GHOSTS 'N GOBLINS — THE CURSED PC GAMING MUSEUM
 * art_items.js — weapons, pickups, mechanisms and FX sprites (art bible section B).
 *
 * Classic script, loads after engine.js. Registers sprites only; no DOM, no randomness.
 */
(function () {
  'use strict';
  var GNG = (typeof window !== 'undefined' ? window : globalThis).GNG;
  if (!GNG || !GNG.defSprite) return;

  var col = GNG.col;

  /* ------------------------------------------------------------------ helpers */

  /** Register a bitmap under `name`, checking the canvas size the gameplay code expects. */
  function reg(name, w, h, anchor, bmp) {
    if (bmp.w !== w || bmp.h !== h) {
      GNG.artWarnings.push(name + ': canvas ' + bmp.w + 'x' + bmp.h + ' (expected ' + w + 'x' + h + ')');
    }
    var o = anchor === 'c' ? { ax: w >> 1, ay: h >> 1 }
      : anchor === 'tl' ? { ax: 0, ay: 0 }
        : { ax: w >> 1, ay: h };
    return GNG.regSprite(name, bmp, o);
  }
  /** Define one sprite from ASCII art. anchor: 'c' centre, 'b' bottom-centre, 'tl' top-left. */
  function def(name, w, h, anchor, legend, art) {
    return reg(name, w, h, anchor, GNG.parseArt(legend, art, name));
  }
  /** Define name0..n from an array of ASCII arts. */
  function defs(prefix, w, h, anchor, legend, arts) {
    for (var i = 0; i < arts.length; i++) def(prefix + i, w, h, anchor, legend, arts[i]);
  }

  /**
   * Top-left bevel for flat-coloured art, so rotated frames stay lit from the upper-left.
   * Pixels of colour `mid` become `hi` where the pixel above or left of them is outside the
   * material and `lo` where the pixel below or right is outside. `mats` lists the colours that
   * count as the same material (defaults to just `mid`).
   */
  function bevel(bmp, mid, hi, lo, mats) {
    var w = bmp.w, h = bmp.h, src = new Uint8Array(bmp.data), set = {}, i, x, y;
    mid = col(mid); hi = col(hi); lo = col(lo);
    mats = mats || [mid];
    for (i = 0; i < mats.length; i++) set[col(mats[i])] = 1;
    function inside(px, py) { return px >= 0 && py >= 0 && px < w && py < h && set[src[py * w + px]] === 1; }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (src[y * w + x] !== mid) continue;
        var tl = !inside(x - 1, y) || !inside(x, y - 1);
        var br = !inside(x + 1, y) || !inside(x, y + 1);
        if (tl && !br) bmp.data[y * w + x] = hi;
        else if (br && !tl) bmp.data[y * w + x] = lo;
      }
    }
    return bmp;
  }

  /** Rotate 90 degrees clockwise about the centre pixel of the top-left n x n region (n odd). */
  function rotIn(bmp, n) {
    var b = new GNG.Bitmap(bmp.w, bmp.h);
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) b.data[x * b.w + (n - 1 - y)] = bmp.data[y * bmp.w + x];
    return b;
  }

  /* ====================================================================== *
   *  WEAPONS
   * ====================================================================== */

  var LW = GNG.makeLegend({
    k: 'outline', w: 'white',
    d: 'steel2', s: 'steel3', S: 'steel4', M: 'steel5', L: 'steel6', W: 'steel7',
    n: 'brown2', b: 'brown3', t: 'brown4', B: 'brown5', T: 'brown6',
    g: 'gold2', G: 'gold4', y: 'gold5', Y: 'gold6',
    r: 'red2', R: 'red4', h: 'hotred',
    e: 'blue2', u: 'blue3', U: 'blue5', c: 'blue7', C: 'hotcyan'
  });

  def('w_lance0', 20, 5, 'c', LW, `
    .............kkkk...
    kkkkkkkkkkkkkWWWLkk.
    kgBBTBBTBBTgLLLLLLWk
    kkkkkkRRRRRkksssskk.
    ......kkrrrk.kkkk...
  `);

  def('w_dagger0', 11, 5, 'c', LW, `
    ..kgkkkk...
    kkkGWWWWkk.
    kGbYLLLLLWk
    kkkGsssskk.
    ..kgkkkk...
  `);

  // Tumbling torch: one drawn frame, wooden handle re-lit after every quarter turn.
  (function () {
    var f = GNG.parseArt(LW, `
      .......kkk
      ......kuUk
      ....kkuUk.
      ...kuUcUk.
      ...kUcwcuk
      ..kgUcccuk
      .kttgUuuk.
      kttkkkkk..
      kttk......
      .kk.......
    `, 'w_torch0');
    for (var i = 0; i < 4; i++) {
      reg('w_torch' + i, 10, 10, 'c', bevel(f.clone(), 'brown4', 'brown6', 'brown3'));
      f = f.rot90();
    }
  })();

  // Spinning axe: flat master (wood 't', steel cheek 'S', honed edge 'W'), re-lit per frame:
  // bright two-pixel bevel along the cutting edge, top-left light on the cheek and handle.
  function litAxe(b) {
    bevel(b, 'brown4', 'brown6', 'brown3');
    var S4 = col('steel4'), W = col('steel7'), w = b.w, h = b.h, src = new Uint8Array(b.data), x, y;
    function at(px, py) { return (px < 0 || py < 0 || px >= w || py >= h) ? 0 : src[py * w + px]; }
    function steel(v) { return v === S4 || v === W; }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (at(x, y) !== S4) continue;
        var edge = at(x + 1, y) === W || at(x - 1, y) === W || at(x, y + 1) === W || at(x, y - 1) === W;
        var tl = !steel(at(x - 1, y)) || !steel(at(x, y - 1));
        var br = !steel(at(x + 1, y)) || !steel(at(x, y + 1));
        var c = S4;
        if (edge) c = col(x + y <= ((w + h) >> 1) ? 'steel6' : 'steel5');
        else if (tl && !br) c = col('steel5');
        else if (br && !tl) c = col('steel2');
        else if (!tl) c = col('steel3');
        b.data[y * w + x] = c;
      }
    }
    return b;
  }
  (function () {
    var f = GNG.parseArt(LW, `
      ...........k..
      ....kk....kWk.
      ...kttk..kSWk.
      ...kttk.kSSSWk
      ..kkttkkkSSSWk
      .kSSttSSSSSSWk
      .kSSttSSSSSSWk
      ..kkttkkkSSSWk
      ...kttk.kSSSWk
      ...kttk..kSWk.
      ...kttk...kWk.
      ...kttk....k..
      ...kttk.......
      ....kk........
    `, 'w_axe0');
    for (var i = 0; i < 4; i++) { reg('w_axe' + i, 14, 14, 'c', litAxe(f.clone())); f = f.rot90(); }
  })();

  // Tumbling golden cross (Latin cross so the spin reads), pivot = pixel 5,5.
  (function () {
    var f = GNG.parseArt(LW, `
      ...kkkkk....
      ...kGGGk....
      .kkkGGGkkk..
      .kGGGGGGGk..
      .kGGGCGGGk..
      .kGGGGGGGk..
      .kkkGGGkkk..
      ...kGGGk....
      ...kGGGk....
      ...kGGGk....
      ...kkkkk....
      ............
    `, 'w_cross0');
    for (var i = 0; i < 4; i++) {
      reg('w_cross' + i, 12, 12, 'c', bevel(f.clone(), 'gold4', 'gold6', 'gold2', ['gold4', 'hotcyan']));
      f = rotIn(f, 11);
    }
  })();

  defs('flame_blue', 10, 16, 'b', LW, [`
    ..........
    ....e.....
    ....ue....
    ...euu....
    ...eUue...
    ...uUUue..
    ..euUcUu..
    ..uUccUue.
    .euUcwcUu.
    .uUcwwcUue
    euUcwwwcUu
    euUcwwwcUu
    euUccwwcUu
    .uUUcccUu.
    .euUUUUue.
    ..euuuue..
  `, `
    ......e...
    ..........
    .....eu...
    .....uue..
    ....eUUu..
    ....uUcue.
    ...euUcUu.
    ..euUccUu.
    ..uUcwcUue
    .euUcwwcUu
    .uUcwwwcUu
    euUcwwwcUu
    euUcwwccUu
    .uUcccUUu.
    .euUUUUue.
    ..euuuue..
  `, `
    ..........
    ..........
    ...e......
    ...ue..e..
    ..euu.eu..
    ..uUueuUe.
    .euUUuUUu.
    .uUcUUcUu.
    .uUccccUue
    euUcwwcUUu
    eUcwwwwcUu
    eUcwwwwcUu
    euUcwwccUu
    .uUUcccUu.
    .euUUUUue.
    ..euuuue..
  `, `
    ..........
    ...e......
    ...ue.....
    ..euu.....
    ..uUUe....
    .euUUu....
    .uUcUue...
    .uUccUue..
    euUcwcUu..
    uUcwwcUue.
    uUcwwwcUu.
    uUcwwwcUue
    uUccwwcUUu
    .uUUcccUu.
    .euUUUUue.
    ..euuuue..
  `]);

  def('icon_lance0', 12, 12, 'c', LW, `
    ......kkkkkk
    .....kWWWWWk
    .....kLWWWLk
    ......kLWLLk
    .....kkkLLsk
    ....kTBkksk.
    ...kTBkRkk..
    ..kTBkRRk...
    .kTBk.kk....
    kTBk........
    kBk.........
    kk..........
  `);

  def('icon_dagger0', 12, 12, 'c', LW, `
    .........kk.
    ........kWLk
    .......kWLsk
    ......kWLsk.
    ..kk.kWLsk..
    .kGYkWLsk...
    ..kGYLsk....
    ...kGYk.....
    ..kBkGYk....
    .kBbkkGgk...
    kYbk..kk....
    .kk.........
  `);

  def('icon_torch0', 12, 12, 'c', LW, `
    .......k....
    ......kuk...
    .....kuUk...
    ....kuUUuk..
    ...kuUcUUk..
    ..kuUcwcUk..
    ..kuUwwcuk..
    ..kkuccukk..
    ...kgYGgk...
    ....kBbk....
    ....kBbk....
    ....kkkk....
  `);

  reg('icon_axe0', 12, 12, 'c', litAxe(GNG.parseArt(LW, `
    ...kk....k..
    ..kttk..kWk.
    ..kttk.kSWk.
    ..kttkkSSSWk
    kkkttkkSSSWk
    kSSttSSSSSWk
    kSSttSSSSSWk
    kkkttkkSSSWk
    ..kttkkSSSWk
    ..kttk.kSWk.
    ..kttk..kWk.
    ...kk....k..
  `, 'icon_axe0')));

  def('icon_cross0', 12, 12, 'c', LW, `
    ...kkkkkk...
    ...kYGGgk...
    kkkkYGGgkkkk
    kYYYYGGGGGgk
    kGGGGcCGGGgk
    kGGGGCuGGGgk
    kggggGGggggk
    kkkkYGGgkkkk
    ...kYGGgk...
    ...kYGGgk...
    ...kGgggk...
    ...kkkkkk...
  `);

  /* ====================================================================== *
   *  CHESTS & PICKUPS
   * ====================================================================== */

  var LC = GNG.makeLegend({
    k: 'outline', K: 'black', w: 'white', h: 'hotyellow',
    n: 'brown1', b: 'brown2', B: 'brown4', T: 'brown6',
    g: 'gold2', y: 'gold3', G: 'gold4', Y: 'gold6'
  });

  defs('chest', 16, 16, 'b', LC, [`
    ................
    ................
    ................
    ................
    ..kkkkkkkkkkkk..
    .kTTGYTTTTGYTTk.
    kTTBGYBBBBGYBBBk
    kTBBGyBBBBGyBBbk
    kBBBGyBBBBGyBbbk
    kkkkkkkYYkkkkkkk
    kTBBGykYgkGyBBbk
    kBBBGyBkkBGyBbbk
    kBBbGyBBBbGybbbk
    kBbbGgbbbbGgbbnk
    kbbbggbbbbggbnnk
    kkkkkkkkkkkkkkkk
  `, `
    ................
    ..kkkkkkkkkkkk..
    .kTTGYTTTTGYTTk.
    kTTBGYBBBBGYBBBk
    kTBBGyBBBBGyBBbk
    kBBBGyBBBBGyBbbk
    kkkkkkkYYkkkkkkk
    .khhwhhhhhhwhhk.
    .kyKKKKKKKKKKyk.
    kkkkkkkkkkkkkkkk
    kTBBGykYgkGyBBbk
    kBBBGyBkkBGyBbbk
    kBBbGyBBBbGybbbk
    kBbbGgbbbbGgbbnk
    kbbbggbbbbggbnnk
    kkkkkkkkkkkkkkkk
  `, `
    ..kkkkkkkkkkkk..
    .kbbGgbbbbGgbbk.
    kbnnGgnnnnGgnnbk
    kbnnGgnnnnGgnnbk
    kbnnGgnnnnGgnnbk
    kbbbGgbbbbGgbbbk
    kkkkkkkkkkkkkkkk
    kKKKKKKKKKKKKKKk
    kKyKKKKKKKKKKyKk
    kTTTGYTTTTGYTTTk
    kTBBGykYgkGyBBbk
    kBBBGyBkkBGyBbbk
    kBBbGyBBBbGybbbk
    kBbbGgbbbbGgbbnk
    kbbbggbbbbggbnnk
    kkkkkkkkkkkkkkkk
  `]);

  /* --- the Magician: body drawn once; casting arm, wand sparkle and smoke puff overlaid per frame.
   *     He rides a little magic cloud because the game pops him out of an open chest. --- */
  var LM = GNG.makeLegend({
    k: 'outline', e: 'black', w: 'white', c: 'hotcyan', Y: 'hotyellow',
    p: 'purple2', P: 'purple4', q: 'purple6',
    y: 'gold5',
    n: 'skin2', s: 'skin4', S: 'skin6', N: 'red6',
    W: 'bone6', b: 'bone4',
    t: 'brown3', T: 'brown6'
  });
  (function () {
    var body = GNG.parseArt(LM, `
      ....................
      .....kk.............
      ....kqPk............
      ....kqPPkk..........
      .....kqPPPk.........
      .....kqPYPPk........
      ......kqPPPPk.......
      ......kqPPPYPk......
      .....kqPPYPPPpk.....
      .....kqPPPPPPPpk....
      ...kkkyyyyyyyyykkk..
      ..kqqPPPPPPPPPPPppk.
      ...kkkWWSeSSeSkkkk..
      .....kWWSSNNSSk.....
      .....kWWWWnnWWWk....
      .....kwWWWWWWWWk....
      ....kqwWWWWWWWbpk...
      ....kqPwWWWWWbPpk...
      ...kqPPbwWWWbPPpk...
      ...kqPPPbwWbPPPpk...
      ...kqPPPPbbPPPPpk...
      ...kqPPYPPpPPPPpk...
      ...kqPPPPPpPPPPpk...
      ..kqPPPpPPPPYPPppk..
      ..kqPPPpPPPPPPPppk..
      ..kqPYPpPPPPPPPppk..
      ..kkkkkkkkkkkkkkkk..
      ....................
    `, 'magician_body');
    var puffs = [GNG.parseArt(LM, `
      ..kk..........kkk...
      .kwWk..kkk...kwWWk..
      kwWWWkkwWWkkkwWWWWk.
      kWWWbWWWWWbWWWWWbbk.
    `, 'magician_puff0'), GNG.parseArt(LM, `
      ...kkk..........kk..
      ..kwWWk...kkk..kwWk.
      .kwWWWWkkkwWWkkwWWWk
      .kWWbWWWWWWWbWWWWbWk
    `, 'magician_puff1')];
    var arms = [`
      ....................
      ....................
      ....................
      ....................
      ....................
      ....................
      ....................
      ....................
      ..................c.
      .................cwc
      ..................c.
      .................kTk
      .................kTk
      ................kTk.
      ................kTk.
      ..............kkSTk.
      .............kqPsSk.
      .............kPPpkk.
      ..............kkk...
    `, `
      ....................
      ....................
      ....................
      .................c..
      .................w..
      ...............cwwwc
      .................w..
      ................kck.
      ................kTk.
      ................kTk.
      ................kTk.
      ................kTk.
      ...............kSTk.
      ..............kqsSk.
      .............kqPPk..
      .............kPPpk..
      .............kPpk...
      ..............kk....
    `, `
      ....................
      ................c...
      ................w...
      .............c.cwc.c
      ..............wwwww.
      .............c.cwc.c
      ................w...
      ...............kTk..
      ...............kTk..
      ...............kTk..
      ...............kTk..
      ..............kSTk..
      .............kqsSk..
      .............kqPk...
      ............kqPPk...
      ............kPPpk...
      ............kPpk....
      .............kk.....
    `, `
      ....................
      ....................
      ....................
      .............c......
      ................c...
      ....................
      ..................c.
      ....................
      .................w..
      ...............c.w.c
      ................www.
      ...............wwwww
      ................www.
      ...............ckwkc
      ................kTk.
      ..............kkSTk.
      .............kqPsSk.
      .............kPPpkk.
      ..............kkk...
    `];
    var lift = [0, -1, -1, 0];           // he stretches up as the wand rises
    for (var i = 0; i < arms.length; i++) {
      var f = new GNG.Bitmap(20, 28);
      f.blit(body, 0, lift[i]);
      f.blit(GNG.parseArt(LM, arms[i], 'magician_arm' + i), 0, lift[i]);
      f.blit(puffs[i & 1], 0, 24);
      reg('magician' + i, 20, 28, 'b', f);
    }
  })();

  var LP = GNG.makeLegend({
    k: 'outline', K: 'black', w: 'white',
    H: 'tan6', T: 'tan5', t: 'tan3', b: 'tan2', n: 'brown2',
    y: 'gold5', g: 'gold3',
    L: 'red6', M: 'red4', m: 'red2',
    G: 'mist6', a: 'mist4',
    R: 'red4', r: 'red2', q: 'red6',
    Y: 'gold6', O: 'gold4', o: 'gold2'
  });

  def('moneybag0', 12, 12, 'b', LP, `
    ...k....k...
    ..kHk..kTk..
    ..kHTkkTtk..
    ...kTTTtk...
    ...kyyygk...
    ..kHTTnnTk..
    .kHTTnTTTtk.
    .kTTTTnTTtk.
    kHTTTTTnTttk
    kTTTTnnTtttk
    kTTtttttttbk
    .kkkkkkkkkk.
  `);

  def('gem0', 8, 8, 'b', LP, `
    ..kkkk..
    .kLwLMk.
    kLwLMMmk
    kLLMMMmk
    kMMMMmmk
    .kMMmmk.
    ..kmmk..
    ...kk...
  `);
  reg('gem1', 8, 8, 'b', GNG.S.gem0.remap(GNG.rampSwap({ red: 'blue' })));

  def('potion_red0', 8, 12, 'b', LP, `
    ....q...
    ..kkkk..
    ..kGak..
    ..kGak..
    ..kRrk..
    .kkRrkk.
    .kRRRrk.
    kRwRRRrk
    kRwRRrrk
    kRRRRrrk
    .krrrrk.
    ..kkkk..
  `);
  reg('potion_green0', 8, 12, 'b', GNG.S.potion_red0.remap(GNG.rampSwap({ red: 'toxic' })));
  reg('potion_blue0', 8, 12, 'b', GNG.S.potion_red0.remap(GNG.rampSwap({ red: 'blue' })));

  def('key0', 14, 8, 'c', LP, `
    .kkkk.........
    kYYYOk........
    kYkkOkkkkkkkk.
    kYkkOYYYYYYYOk
    kOkkoOOOOOOOok
    kOkkokkkOkOok.
    kOOOok.kOkOok.
    .kkkk...k.kk..
  `);

  /* --- THE CURSED FLOPPY DISK --- */
  var LF = GNG.makeLegend({
    k: 'outline', K: 'black', w: 'white',
    d: 'gray1', D: 'gray2', E: 'gray4',
    s: 'steel3', S: 'steel5', L: 'steel6', W: 'steel7',
    l: 'bone7', c: 'bone5',
    R: 'hotred', r: 'red3'
  });
  (function () {
    var f0 = def('floppy0', 16, 16, 'c', LF, `
      kkkkkkkkkkkkkk..
      kEEDSWLLLLLsDDk.
      kEDDSWLLLKKsDDdk
      kEDDSLLLLKKsDDdk
      kEDDSLLLLKKsDDdk
      kEDDsssssssdDDdk
      kEDDDDDDDDDDDDdk
      kEllllllllllllck
      kElllRRRRRllllck
      kEllRRRRRRRlllck
      kEllRKKRKKRlllck
      kEllRRRKRRRlllck
      kElllRRRRRllllck
      kElllRKRKRllllck
      kEccccccccccccck
      kkkkkkkkkkkkkkkk
    `);
    var f1 = f0.clone(), W = col('white');
    // glint: sparkle on the shutter corner + a light streak across the plastic
    f1.vline(4, 0, 7, W); f1.hline(1, 3, 7, W);
    f1.pset(3, 2, W); f1.pset(5, 2, W); f1.pset(3, 4, W); f1.pset(5, 4, W);
    reg('floppy1', 16, 16, 'c', f1);
  })();

  var LH = GNG.makeLegend({
    k: 'outline', K: 'black', w: 'white',
    Y: 'gold6', G: 'gold4', g: 'gold2', y: 'gold5',
    R: 'red4', r: 'red2'
  });
  def('oneup0', 12, 12, 'b', LH, `
    ............
    ..krRk......
    .krRRRkkk...
    .kRrkYYGGkk.
    ..kkYwYGGGgk
    ..kYwYGGGGgk
    ..kYYGGGGGgk
    ..kYGGKKKKKk
    ..kYGGGGGggk
    ..kYGGGkGkgk
    ..kgGGGGGggk
    ...kkkkkkkk.
  `);

  /* --- save post --- */
  var LSV = GNG.makeLegend({
    k: 'outline', K: 'black', w: 'white', C: 'hotcyan',
    D: 'steel2', d: 'steel1', s: 'steel3', S: 'steel4', l: 'steel5', c: 'steel3',
    B: 'brown5', b: 'brown3', n: 'brown2', T: 'brown6',
    u: 'blue3', U: 'blue5', e: 'blue7'
  });
  def('savepost0', 12, 26, 'b', LSV, `
    ............
    .kkkkkkkkk..
    .kDsSSKsDDk.
    .kDsSSKsDDk.
    .kDDDDDDDDk.
    .kDllllllDk.
    .kDlcccclDk.
    .kDllllllDk.
    .kDlccclldk.
    .kDlllllldk.
    .kkkkkkkkkk.
    ....kTbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ..kkkBbkkk..
    .kbBBBbbnnk.
  `);
  def('savepost1', 12, 26, 'b', LSV, `
    .C...C....C.
    .kkkkkkkkk..
    CkUewwKeUUk.
    .kUewwKeUUkC
    .kUUUUUUUUk.
    CkUwwwwwwUk.
    .kUwCCCCwUkC
    .kUwwwwwwUk.
    CkUwCCCwwuk.
    .kUwwwwwwukC
    .kkkkkkkkkk.
    ..C.kTbk.C..
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ....kBbk....
    ..kkkBbkkk..
    .kbBBBbbnnk.
  `);

  /* --- world map markers --- */
  var LMP = GNG.makeLegend({
    k: 'outline', K: 'black', w: 'bone7', W: 'bone7', b: 'bone5', h: 'hotred',
    R: 'red4', r: 'red2', q: 'red6', S: 'steel6', s: 'steel3', Y: 'gold6',
    n: 'brown2', B: 'brown4'
  });
  def('map_skull0', 9, 9, 'c', LMP, `
    ..kkkkk..
    .kWWWWbk.
    kWWWWWWbk
    kWKKWKKbk
    kWKhWhKbk
    kWWWKWWbk
    .kWWWWbk.
    .kWKWKbk.
    ..kkkkk..
  `);
  def('map_flag0', 9, 12, 'b', LMP, `
    ...k.....
    ..kYkkkk.
    ..kSRRRRk
    ..kSRqRRk
    ..kSRRRRk
    ..kSrrrrk
    ..kSkkkk.
    ..kSk....
    ..kSk....
    ..kSk....
    ..kSk....
    .kkkkk...
  `);

  /* ====================================================================== *
   *  MECHANISMS  (anchor top-left)
   * ====================================================================== */

  var LS = GNG.makeLegend({
    k: 'outline', K: 'black',
    1: 'steel1', 2: 'steel2', 3: 'steel3', 4: 'steel4', 5: 'steel5', 6: 'steel6', 7: 'steel7',
    r: 'red2', R: 'red3',
    y: 'gold5', Y: 'hotyellow', o: 'gold3'
  });

  // Prince-of-Persia chomper. Closed = top stacked on bottom with the three fangs meeting tip to tip.
  def('slicer_top0', 16, 24, 'tl', LS, `
    k65444444444432k
    k65444444444432k
    k65444444444432k
    k22222222222222k
    k66666666666653k
    k65444444444432k
    k65754444447532k
    k65524444445232k
    k65444444444432k
    k65444444444432k
    k65333333333322k
    k22222222222222k
    k66666666666653k
    k65555555555432k
    k65555555555432k
    k65555555555432k
    k6543k6543k6543k
    k6543k6543k6543k
    .k643kk643kk643k
    .k643kk643kk643k
    .k64k.k64k.k64k.
    .k64k.k6rk.k64k.
    ..k5k..kRk..k5k.
    ...7....R....7..
  `);
  def('slicer_bot0', 16, 24, 'tl', LS, `
    ...7....R....7..
    ..k5k..kRk..k5k.
    .k64k.k6rk.k64k.
    .k64k.k64k.k64k.
    .k643kk643kk643k
    .k643kk643kk643k
    k6543k6543k6543k
    k6543k6543k6543k
    k65555555555432k
    k65555555555432k
    k65555555555432k
    k65333333333322k
    k22222222222222k
    k66666666666653k
    k65444444444432k
    k65754444447532k
    k65524444445232k
    k65444444444432k
    k65444444444432k
    k65333333333322k
    k22222222222222k
    k66666666666653k
    k65444444444432k
    k65444444444432k
  `);

  // Pressure plate: the game sinks frame 1 one more pixel into the floor.
  def('plate0', 16, 5, 'tl', LS, `
    ................
    .kkkkkkkkkkkkkk.
    k67666666666665k
    k5y4444yy4444y3k
    kkkkkkkkkkkkkkkk
  `);
  def('plate1', 16, 5, 'tl', LS, `
    ................
    ................
    .kkkkkkkkkkkkkk.
    k55444444444433k
    k3o3333oo3333o2k
  `);

  // Iron portcullis: three chunky bars, riveted cross-bands, pointed feet. The game stacks copies
  // for tall doorways, so a band sits on the very top row to carry the feet of the copy above.
  (function () {
    var b = new GNG.Bitmap(16, 48), k = col('outline'), S = GNG.C.steel, y, i, j;
    var bars = [0, 6, 12];
    for (i = 0; i < 3; i++) {
      var x = bars[i];
      for (y = 0; y < 45; y++) {
        b.pset(x, y, k); b.pset(x + 1, y, S[5]); b.pset(x + 2, y, S[3]); b.pset(x + 3, y, k);
      }
      // spear-point foot
      b.pset(x, 45, k); b.pset(x + 1, 45, S[6]); b.pset(x + 2, 45, S[3]); b.pset(x + 3, 45, k);
      b.pset(x, 46, k); b.pset(x + 1, 46, S[5]); b.pset(x + 2, 46, k);
      b.pset(x + 1, 47, k);
    }
    var bands = [0, 19, 36];
    for (i = 0; i < bands.length; i++) {
      y = bands[i];
      b.hline(0, y, 16, k);
      b.hline(1, y + 1, 14, S[6]); b.hline(1, y + 2, 14, S[4]); b.hline(1, y + 3, 14, S[2]);
      b.hline(0, y + 4, 16, k);
      b.vline(0, y + 1, 3, k); b.vline(15, y + 1, 3, k);
      for (j = 0; j < 3; j++) { b.pset(bars[j] + 1, y + 2, S[7]); b.pset(bars[j] + 2, y + 2, S[1]); }
    }
    // a few rust blooms
    var rust = [[1, 9], [2, 10], [7, 15], [14, 12], [13, 28], [8, 30], [7, 31], [1, 33], [14, 43], [8, 42]];
    for (i = 0; i < rust.length; i++) b.pset(rust[i][0], rust[i][1], col(i & 1 ? 'rust3' : 'rust4'));
    reg('gate0', 16, 48, 'tl', b);
  })();

  // Crusher head: riveted cap, hazard stripes, thick flat steel underside.
  (function () {
    var b = new GNG.Bitmap(32, 16), k = col('outline'), x, y;
    var S = GNG.C.steel, G = GNG.C.gold;
    // upper block (cols 1..30, rows 0..10)
    b.rect(1, 0, 30, 11, k);
    b.rect(2, 1, 28, 1, S[6]); b.rect(2, 2, 28, 1, S[4]); b.rect(2, 3, 28, 1, S[2]);
    b.pset(2, 1, S[7]); b.pset(29, 1, S[4]); b.pset(29, 2, S[3]);
    for (x = 4; x < 29; x += 6) { b.pset(x, 2, S[7]); b.pset(x + 1, 2, S[2]); }
    for (y = 4; y < 10; y++) {
      for (x = 2; x < 30; x++) {
        var stripe = ((x + y) >> 2) & 1;
        var c = stripe ? (y === 4 ? G[6] : (y === 9 ? G[3] : G[4])) : (y === 4 ? GNG.C.gray[2] : GNG.C.gray[0]);
        b.pset(x, y, c);
      }
    }
    // flat underside slab (cols 0..31, rows 10..15)
    b.rect(0, 10, 32, 6, k);
    b.rect(1, 11, 30, 1, S[6]); b.rect(1, 12, 30, 2, S[4]); b.rect(1, 14, 30, 1, S[2]);
    b.pset(1, 11, S[7]); b.pset(1, 12, S[6]); b.pset(1, 13, S[5]);
    b.pset(30, 11, S[4]); b.pset(30, 12, S[2]); b.pset(30, 13, S[2]);
    for (x = 3; x < 30; x += 5) { b.pset(x, 12, S[6]); b.pset(x, 13, S[3]); }
    reg('piston_head0', 32, 16, 'tl', b);
  })();

  def('piston_shaft0', 16, 16, 'tl', LS, `
    ...k35765432k...
    ...k35765432k...
    ...k35765432k...
    ...k35765432k...
    ...k35765432k...
    ...k35765432k...
    ..kkkkkkkkkkkk..
    ..k4677765432k..
    ..k3566654321k..
    ..kkkkkkkkkkkk..
    ...k24654321k...
    ...k35765432k...
    ...k35765432k...
    ...k35765432k...
    ...k35765432k...
    ...k35765432k...
  `);

  // Spectral platform: a thigh bone bound in glowing ectoplasm. Tiles horizontally.
  var LG = GNG.makeLegend({
    k: 'outline',
    0: 'teal0', 1: 'teal1', 2: 'teal2', 3: 'teal3', 4: 'teal4', 5: 'teal5', 6: 'teal6', 7: 'teal7',
    w: 'white'
  });
  defs('ghost_plat', 16, 8, 'tl', LG, [`
    5566556655665566
    4w74444444444w74
    3777777777777773
    3763333333333763
    2332233223322332
    .22.12.22.21.22.
    ..1..1..2..1..2.
    .....1.....1....
  `, `
    6655665566556655
    4w74444444444w74
    3777777777777773
    3763333333333763
    3223322332233223
    .21.22.12.22.21.
    .1..2..1..1...1.
    ....1.....1.....
  `]);

  // Rolling barrel seen end-on: the plank lid turns, the iron hoop keeps its lighting.
  var LB = GNG.makeLegend({
    k: 'outline',
    n: 'brown1', b: 'brown2', t: 'brown4', B: 'brown5', T: 'brown6',
    1: 'steel1', 2: 'steel2', 3: 'steel3', 4: 'steel4', 5: 'steel5', 6: 'steel6'
  });
  (function () {
    var lid = GNG.parseArt(LB, `
      ..............
      ..............
      ....BbTTTb....
      ...BBbTTTbB...
      ..BtBbTTTbBB..
      ..BtBbTtTbBB..
      ..BBBbTtTbBB..
      ..BBBbTTTbtB..
      ..BBBbTTTbtB..
      ..BBBbTnTbBB..
      ...BBbTTTbB...
      ....BbTTTb....
      ..............
      ..............
    `, 'barrel_lid');
    var hoop = GNG.parseArt(LB, `
      ....kkkkkk....
      ..kk665544kk..
      .k66......43k.
      .k6........3k.
      k6..........3k
      k5..........2k
      k5..........2k
      k4..........2k
      k4..........1k
      k3..........1k
      .k3........1k.
      .k32......11k.
      ..kk222111kk..
      ....kkkkkk....
    `, 'barrel_hoop');
    for (var i = 0; i < 4; i++) {
      var f = lid.clone();
      f.blit(hoop, 0, 0);
      reg('barrel' + i, 14, 14, 'c', f);
      lid = lid.rot90();
    }
  })();

  var LT = GNG.makeLegend({
    k: 'outline', w: 'white',
    H: 'gray6', L: 'gray5', M: 'gray4', m: 'gray3', d: 'gray2', D: 'gray1',
    g: 'toxic2', t: 'toxic3', G: 'toxic4', T: 'toxic6', x: 'toxic7'
  });
  defs('barrel_toxic', 12, 16, 'b', LT, [`
    ............
    ...kkkkkk...
    .kkGGTGGGkk.
    kLGTxGGGGGdk
    kLtGGGGGGtdk
    kHLtttttttmk
    kLMMMGMmmmdk
    kHHHHGHLLLmk
    kmmmmtmmdddk
    kLMMMGMmmmdk
    kLMMMtMmmmdk
    kHHHHHHLLLmk
    kmmmmmmmdddk
    kLMMMMMmmmdk
    kLMMMMmmmddk
    .kkkkkkkkkk.
  `, `
    ............
    ...kkkkkk...
    .kkGGGGTGkk.
    kLGGGGGTxGdk
    kLtGTGGGGtdk
    kHLtttttttmk
    kLMMMGMmmmdk
    kHHHHGHLLLmk
    kmmmmGmmdddk
    kLMMMGMmmmdk
    kLMMMGMmmmdk
    kHHHHtHLLLmk
    kmmmmmmmdddk
    kLMMMMMmmmdk
    kLMMMMmmmddk
    .kkkkkkkkkk.
  `]);

  /* ====================================================================== *
   *  FX
   * ====================================================================== */

  var LX = GNG.makeLegend({
    w: 'white', y: 'hotyellow', o: 'hotorange', r: 'ember3', c: 'blue7', C: 'hotcyan', u: 'blue5',
    g: 'gold7', G: 'gold5',
    D: 'bone6', d: 'bone4', e: 'bone2',
    2: 'liq2', 3: 'liq3', 4: 'liq4', 5: 'liq5', 6: 'liq6', 7: 'liq7',
    T: 'teal7', t: 'teal6', a: 'teal4', b: 'teal3', z: 'teal2', k: 'teal1'
  });

  defs('fx_spark', 9, 9, 'c', LX, [`
    .........
    .........
    ....y....
    ...ywy...
    ..ywwwy..
    ...ywy...
    ....y....
    .........
    .........
  `, `
    ....o....
    ....y....
    ..o.w.o..
    ...ywy...
    oywwwwwyo
    ...ywy...
    ..o.w.o..
    ....y....
    ....o....
  `, `
    ....o....
    .........
    .o.....o.
    .........
    o...y...o
    .........
    .o.....o.
    .........
    ....o....
  `]);

  defs('fx_sparkle', 7, 7, 'c', LX, [`
    .......
    .......
    .......
    ...w...
    .......
    .......
    .......
  `, `
    .......
    .......
    ...c...
    ..cwc..
    ...c...
    .......
    .......
  `, `
    ...c...
    ...w...
    ..cwc..
    cwwwwwc
    ..cwc..
    ...w...
    ...c...
  `, `
    .......
    .c...c.
    ..c.c..
    ...w...
    ..c.c..
    .c...c.
    .......
  `]);

  defs('fx_dust', 12, 8, 'b', LX, [`
    ............
    ............
    ............
    ............
    ............
    ...DD..DD...
    ..DDddDDdd..
    ..ddee.dde..
  `, `
    ............
    ............
    ............
    .DD......DD.
    DDDd....DDDd
    DDdd.DD.Dddd
    .dde.dd..de.
    ............
  `, `
    ............
    .D........D.
    DDd......DDd
    .d........d.
    ...d....d...
    ............
    ............
    ............
  `]);

  // Liquid splash: liq2..liq7 only, so every stage's palette (and its colour cycling) recolours it.
  defs('fx_splash', 16, 16, 'b', LX, [`
    ................
    ................
    ................
    ................
    ................
    ................
    ................
    ................
    ................
    ....4......4....
    ....43....43....
    .....43..43.....
    .....435543.....
    ....44355335....
    ...6443553356...
    ..664355335366..
  `, `
    ................
    ................
    ................
    .......44.......
    .......43.......
    .4.....43.....4.
    .43....45....43.
    ..43...43...43..
    ..45...45...45..
    ...43..43..43...
    ...45..43..45...
    ....43.45.43....
    ....44354353....
    ...6435343536...
    ..664353435366..
    .76643534353667.
  `, `
    .......44.......
    .......43.......
    4..............4
    43.....44.....43
    .3.....43.....3.
    ................
    .44....45....44.
    ..3....43....3..
    ..45...4....45..
    ...3...43...3...
    ...45..45..45...
    ....3..43..3....
    ....45.43.45....
    ....43543543....
    ..664353435366..
    7666435343536667
  `, `
    ................
    ................
    ................
    ................
    ..4..........4..
    ..3....4.....3..
    .......3........
    .4............4.
    .3..4......4..3.
    ....3......3....
    ..4....4.....4..
    ..5....5.....5..
    .....4....4.....
    .....3....3.....
    ...66.5335.66...
    7666653553566667
  `]);

  // Ectoplasm splat: glob -> starburst -> flying droplets.
  defs('fx_ecto', 12, 12, 'c', LX, [`
    ............
    ............
    ..z..kk.....
    ...zbaabz.z.
    ...batTabz..
    ..kaTTTtabk.
    ..kaTTttabk.
    ...batttbz..
    ..z.baabz...
    .....kk..z..
    ............
    ............
  `, `
    .....z......
    .z...bz...z.
    ..bz.ab..bz.
    ...baatabz..
    ...atTTtaa..
    zbaaTTTttabz
    .zbatTttabz.
    ...aattaab..
    ..bz.ab.zb..
    .z...bz..bz.
    ......z...z.
    ............
  `, `
    .t....a....t
    .a..........
    ...z....z...
    a..........t
    ......b....a
    .t..........
    .a...z......
    ..........t.
    t..z......a.
    a.......z...
    ....t.......
    ....a....t..
  `]);

  /* --- procedural bursts: lobed blobs painted as nested discs, lit from the upper-left --- */

  /**
   * lobes: [[cx, cy, r], ...]. layers: [[inset, colour, shift], ...] painted in order; every layer
   * shrinks each lobe by `inset` and slides it `shift` px toward the upper-left.
   * holes: [[cx, cy, r], ...] punched out last.
   */
  function burst(b, lobes, layers, holes) {
    var i, j;
    for (i = 0; i < layers.length; i++) {
      var inset = layers[i][0], c = col(layers[i][1]), sh = layers[i][2] || 0;
      for (j = 0; j < lobes.length; j++) {
        var r = lobes[j][2] - inset;
        if (r > 0.4) b.disc(lobes[j][0] - sh, lobes[j][1] - sh, r, c);
      }
    }
    if (holes) for (i = 0; i < holes.length; i++) b.disc(holes[i][0], holes[i][1], holes[i][2], 0);
    return b;
  }
  /** Four-point star rays (hit flashes). */
  function rays(b, cx, cy, len, c1, c2) {
    for (var i = 1; i <= len; i++) {
      var c = i > len * 0.6 ? c2 : c1;
      b.pset(cx + i, cy, c); b.pset(cx - i, cy, c); b.pset(cx, cy + i, c); b.pset(cx, cy - i, c);
    }
  }
  /** Checkerboard-erase pixels of the given colours ("thinning smoke"). */
  function thin(b, names, phase) {
    var set = {}, i, x, y;
    for (i = 0; i < names.length; i++) set[col(names[i])] = 1;
    for (y = 0; y < b.h; y++) for (x = 0; x < b.w; x++) {
      if (set[b.data[y * b.w + x]] && ((x + y + (phase | 0)) & 1)) b.data[y * b.w + x] = 0;
    }
    return b;
  }

  var FIRE = [[0, 'ember1', 0], [1, 'ember3', 0], [2.2, 'ember4', 0.3], [3.8, 'ember5', 0.6], [5.2, 'ember6', 0.9], [6.6, 'ember7', 1.2], [8.2, 'white', 1.5]];
  var FLASH = [[0, 'ember4', 0], [1, 'ember6', 0], [2, 'ember7', 0.2], [3, 'white', 0.4]];
  var FIRE_COOL = [[0, 'ember0', 0], [1, 'ember1', 0], [2, 'ember2', 0.4], [3.2, 'ember3', 0.8], [4.6, 'ember4', 1.2], [6, 'ember5', 1.5]];
  var SMOKE = [[0, 'gray2', 0], [1, 'gray3', 0.3], [2.4, 'gray4', 0.8], [4, 'gray5', 1.3]];
  var SMOKE_DARK = [[0, 'gray1', 0], [1, 'gray2', 0.3], [2.4, 'gray3', 0.8]];

  // fx_poof0..4 (20x20): flash -> flame puff -> flame ring -> smoke -> wisps
  (function () {
    var b;
    b = burst(new GNG.Bitmap(20, 20), [[10, 10, 3.5]], FLASH);
    rays(b, 10, 10, 7, col('white'), col('ember6'));
    reg('fx_poof0', 20, 20, 'c', b);

    b = burst(new GNG.Bitmap(20, 20), [[10, 10, 6.5], [6, 6.5, 3.5], [14, 7, 3], [6, 13.5, 3], [14, 13, 3.5]], FIRE);
    reg('fx_poof1', 20, 20, 'c', b);

    b = burst(new GNG.Bitmap(20, 20), [[10, 10, 7], [5, 5.5, 4], [15, 6, 3.5], [4.5, 13.5, 3.5], [15, 14.5, 4], [10, 3.5, 3], [10, 16.5, 3]],
      FIRE_COOL, [[10, 10, 3.5], [6.5, 12, 1.5], [13.5, 7.5, 1.5]]);
    reg('fx_poof2', 20, 20, 'c', b);

    b = burst(new GNG.Bitmap(20, 20), [[5.5, 5.5, 4.5], [14.5, 5.5, 4], [4.5, 14, 4], [15, 14.5, 4.5], [10, 3, 3], [10, 17, 3]], SMOKE);
    reg('fx_poof3', 20, 20, 'c', thin(b, ['gray2']));

    b = burst(new GNG.Bitmap(20, 20), [[4, 4, 3.5], [16, 4, 3], [3.5, 16, 3], [16.5, 16, 3.5], [10, 2, 2.5]], SMOKE_DARK);
    reg('fx_poof4', 20, 20, 'c', thin(b, ['gray1', 'gray2']));
  })();

  // fx_explode0..5 (32x32): flash -> fireball -> full bloom -> breaking up -> smoke ring -> wisps
  (function () {
    var b;
    b = burst(new GNG.Bitmap(32, 32), [[16, 16, 5.5]], FLASH);
    rays(b, 16, 16, 12, col('white'), col('ember6'));
    reg('fx_explode0', 32, 32, 'c', b);

    b = burst(new GNG.Bitmap(32, 32), [[16, 16, 9.5], [10, 10.5, 5], [22, 11, 5], [10, 21.5, 5], [22, 21, 5]], FIRE);
    reg('fx_explode1', 32, 32, 'c', b);

    b = burst(new GNG.Bitmap(32, 32), [[13, 13, 9.5], [19.5, 15, 9.5], [15, 20, 9], [8, 8.5, 5.5], [24, 8.5, 5.5], [7, 22, 5.5], [24.5, 23, 5.5], [16, 5, 4.5], [17, 27, 4.5]], FIRE);
    reg('fx_explode2', 32, 32, 'c', b);

    b = new GNG.Bitmap(32, 32);
    burst(b, [[7, 7, 6.5], [25, 7.5, 6], [6, 23, 6], [25.5, 24.5, 6.5], [16, 4, 4.5], [16, 28, 4.5], [3.5, 15, 3.5], [28.5, 16, 3.5]], SMOKE_DARK);
    burst(b, [[16, 16, 11], [9, 10, 6], [23, 10, 5.5], [8.5, 21, 5.5], [23, 22.5, 6]], FIRE_COOL, [[16, 16, 4.5], [10.5, 18.5, 2.5], [21.5, 13, 2.5]]);
    reg('fx_explode3', 32, 32, 'c', b);

    b = burst(new GNG.Bitmap(32, 32), [[7, 7, 6.5], [25, 7, 6], [6, 23.5, 6], [25, 25, 6.5], [16, 4, 4.5], [16, 28, 4.5], [3.5, 15, 3.5], [28.5, 16.5, 3.5]], SMOKE);
    b.pset(13, 14, col('ember3')); b.pset(19, 18, col('ember4')); b.pset(15, 20, col('ember2')); b.pset(20, 12, col('ember2'));
    reg('fx_explode4', 32, 32, 'c', thin(b, ['gray2']));

    b = burst(new GNG.Bitmap(32, 32), [[5.5, 5.5, 4.5], [27, 5.5, 4], [4.5, 26, 4], [27, 27, 4.5], [16, 2.5, 3], [16, 29.5, 3], [2.5, 15, 2.5], [29.5, 17, 2.5]], SMOKE_DARK);
    reg('fx_explode5', 32, 32, 'c', thin(b, ['gray1', 'gray2']));
  })();

})();
