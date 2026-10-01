'use strict';
/* =============================================================================
 *  GHOSTS 'N GOBLINS · THE CURSED PC GAMING MUSEUM — sprites.js
 *  All pixel art is generated at boot:
 *   - a parametric "paper-doll" renderer poses articulated humanoids (Sir
 *     Arthur in Steel / Gold / strawberry boxers, zombies, skeletons, haunted
 *     armour, cyber-imps) into multi-frame sprites with auto rim-shading and
 *     1px outlines;
 *   - ASCII-art heads, lemmings, bats, items;
 *   - painter functions for Red Arremers, chests, weapons and giant bosses.
 * ===========================================================================*/
const SPR = {};
const Sprites = (() => {
  const G = GFX, hex = G.hex, shade = G.shade;
  const OUT = hex('#140a1c');
  const PI = Math.PI;

  // ------------------------------------------------------------ helpers
  function autoShade(s) {
    const w = s.w, h = s.h, d = s.d, o = new Uint32Array(d);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = d[y * w + x]; if (!(c >>> 24)) continue;
      const up = y > 0 ? d[(y - 1) * w + x] >>> 24 : 0, dn = y < h - 1 ? d[(y + 1) * w + x] >>> 24 : 0;
      const lf = x > 0 ? d[y * w + x - 1] >>> 24 : 0, rt = x < w - 1 ? d[y * w + x + 1] >>> 24 : 0;
      if (!up || !lf) o[y * w + x] = shade(c, 1.22); else if (!dn || !rt) o[y * w + x] = shade(c, 0.78);
    }
    s.d = o;
  }
  function finish(s, shadeIt = true) { if (shadeIt) autoShade(s); return G.outline(s, OUT); }
  function scale(s, k) {
    const w = Math.round(s.w * k), h = Math.round(s.h * k);
    return G.makeSprite(w, h, t => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) t.d[y * w + x] = s.d[Math.min(s.h - 1, (y / k) | 0) * s.w + Math.min(s.w - 1, (x / k) | 0)]; }, Math.round(s.ax * k), Math.round(s.ay * k));
  }
  function recolor(s, map) {
    return G.makeSprite(s.w, s.h, t => { for (let i = 0; i < s.d.length; i++) { const v = s.d[i]; t.d[i] = map.has(v) ? map.get(v) : v; } }, s.ax, s.ay);
  }
  const asc = (rows, pal, ax, ay) => G.fromAscii(rows, pal, ax == null ? rows[0].length >> 1 : ax, ay == null ? rows.length >> 1 : ay);

  // ------------------------------------------------------------ palette
  const P = {
    metal: hex('#a9b3cc'), metalL: hex('#eef2ff'), metalD: hex('#5a6384'), boot: hex('#3b3f58'), belt: hex('#7c4a1e'),
    gold: hex('#f0bd34'), goldL: hex('#fff3a8'), goldD: hex('#9c6610'), cape: hex('#c81e34'), capeD: hex('#7a0c1e'),
    skin: hex('#f4b47c'), skinD: hex('#c07448'), hair: hex('#6a3818'), beard: hex('#8a4a22'), white: hex('#f6f2ea'), straw: hex('#e8203a'), leaf: hex('#2caa3c'),
    zskin: hex('#88a672'), zskinD: hex('#566c4a'), rag: hex('#6c4a7c'), ragD: hex('#44304e'), red: hex('#e03030'), redL: hex('#ff8a7a'),
    bone: hex('#ece4c8'), boneD: hex('#b0a680'), dark: hex('#1e1a2a'), eye: hex('#ff3a20'), yellow: hex('#ffe040'),
    hmetal: hex('#6e7496'), hmetalD: hex('#3e4260'), imp: hex('#b4542c'), impD: hex('#6c2c14'), uni: hex('#58703e'),
  };

  // ------------------------------------------------------------ heads (facing right)
  const HEADS = {};
  function buildHeads() {
    HEADS.steel = asc([
      '...rrr...', '..rRRr...', '.ggGGgg..', 'gGGggggg.', 'gGgggdddd', 'gggggdddd', 'ggggggggg', '.ggggggg.', '..ggggg..'],
      { r: P.red, R: P.redL, g: P.metal, G: P.metalL, d: P.dark });
    HEADS.gold = asc([
      '...rrr...', '..rRRr...', '.ggGGgg..', 'gGGggggg.', 'gGgggdddd', 'gggggdddd', 'ggggggggg', '.ggggggg.', '..ggggg..'],
      { r: P.cape, R: P.redL, g: P.gold, G: P.goldL, d: P.dark });
    HEADS.boxers = asc([
      '..hhhh...', '.hhhhhh..', 'hhhssss..', 'hhssssss.', 'hhsssesss', '.hssssss.', '.hbbbbbs.', '..bbbbb..', '...bbb...'],
      { h: P.hair, s: P.skin, e: P.dark, b: P.beard });
    HEADS.zombie = asc([
      '..h.h....', '.gggggh..', 'gggggggg.', 'ggggegeg.', 'gggggggg.', 'gggkkkkg.', '.ggggggg.', '..gg.gg..', '...g.....'],
      { h: P.ragD, g: P.zskin, e: P.eye, k: P.dark });
    HEADS.pirate = asc([
      '..rrrr...', '.rrrrrrr.', 'rrggggrr.', 'ggggegkg.', 'gggggkkg.', 'gggkkkkg.', '.ggggggg.', '..gg.gg..', '...g.....'],
      { r: P.red, g: P.zskin, e: P.eye, k: P.dark });
    HEADS.trooper = asc([
      '..mmmm...', '.mmmmmm..', 'mmmmmmmm.', 'ggggegeg.', 'gggggggg.', 'gggkkkkg.', '.ggggggg.', '..gg.gg..', '...g.....'],
      { m: hex('#6a7a5a'), g: P.zskin, e: P.eye, k: P.dark });
    HEADS.skull = asc([
      '..wwwww..', '.wwwwwww.', 'wwwwwwwww', 'wwkkwkkww', 'wwkkwkkww', 'wwwwkwwww', '.wwwwwww.', '..wkwkw..', '..wwwww..'],
      { w: P.bone, k: P.dark });
    HEADS.turban = asc([
      '..tttt...', '.ttrttt..', 'tttttttt.', 'wwkkwkkww', 'wwkkwkkww', 'wwwwkwwww', '.wwwwwww.', '..wkwkw..', '..wwwww..'],
      { t: hex('#e8e0f0'), r: P.red, w: P.bone, k: P.dark });
    HEADS.haunt = asc([
      'k.......k', '.k.....k.', '..ggggg..', '.gGgggggg', 'ggggeeeee', 'gggggkkkk', 'ggggggggg', '.ggggggg.', '..ggggg..'],
      { k: P.dark, g: P.hmetal, G: P.metal, e: P.eye });
    HEADS.imp = asc([
      'k......k.', '.k....k..', '.bbbbbb..', 'bbbbbbbb.', 'bbbbbyyb.', 'bbbbbbbbb', 'bbbkkkkb.', '.bwbwbb..', '..bbbb...'],
      { k: P.boneD, b: P.imp, y: P.yellow, w: P.white });
  }

  // ------------------------------------------------------------ paper-doll
  const DN = (x, y, a, l) => [x + Math.sin(a) * l, y + Math.cos(a) * l];
  function doll(pose, O) {
    const s = G.makeSprite(28, 34, s => {
      const L = pose.lean || 0, hip = [14 + (pose.hx || 0), 22 + (pose.drop || 0)];
      const legs = pose.legs, arms = pose.arms;
      const sh = DN(hip[0], hip[1], PI - L, 7.2), headC = DN(hip[0], hip[1], PI - L, 11.6);
      const leg = i => { const k = DN(hip[0], hip[1], legs[i][0], 5.6); const a = DN(k[0], k[1], legs[i][1], 5.6); return [k, a, [a[0] + 2.4, a[1]]]; };
      const arm = i => { const e = DN(sh[0], sh[1], arms[i][0], 4.5); const h = DN(e[0], e[1], arms[i][1], 4.3); return [e, h]; };
      const L0 = leg(0), L1 = leg(1), A0 = arm(0), A1 = arm(1);
      const lr = O.legR || 1.8, ar = O.armR || 1.4;
      const drawLeg = (Lg, dk) => {
        const f = c => dk ? shade(c, 0.7) : c;
        G.thick(hip[0], hip[1], Lg[0][0], Lg[0][1], lr, f(O.thigh));
        G.thick(Lg[0][0], Lg[0][1], Lg[1][0], Lg[1][1], lr * 0.95, f(O.shin));
        G.thick(Lg[1][0], Lg[1][1] + 0.3, Lg[2][0], Lg[2][1] + 0.3, lr * 0.75, f(O.foot));
        if (O.knee) G.disc(Lg[0][0], Lg[0][1], lr * 0.8, f(O.knee));
      };
      const drawArm = (Ar, dk) => {
        const f = c => dk ? shade(c, 0.7) : c;
        G.thick(sh[0], sh[1], Ar[0][0], Ar[0][1], ar, f(O.arm));
        G.thick(Ar[0][0], Ar[0][1], Ar[1][0], Ar[1][1], ar * 0.95, f(O.fore || O.arm));
        G.disc(Ar[1][0], Ar[1][1], ar * 0.9, f(O.hand || O.arm));
      };
      // cape (behind everything)
      if (O.cape) {
        const fl = pose.cape || 0;
        G.poly([sh[0] - 1, sh[1] - 1, sh[0] + 1.5, sh[1], hip[0] - 1 - fl * 0.4, hip[1] + 6, hip[0] - 7 - fl, hip[1] + 8 - fl * 0.5, hip[0] - 6 - fl, hip[1] + 1], O.cape);
        G.poly([hip[0] - 6 - fl, hip[1] + 1, hip[0] - 7 - fl, hip[1] + 8 - fl * 0.5, hip[0] - 4 - fl, hip[1] + 5], O.capeD);
      }
      if (O.backShield) { G.rect(sh[0] - 7, sh[1], 5, 9, O.backShield); }
      drawArm(A0, true);
      drawLeg(L0, true);
      O.torso(hip, sh, L, O);
      drawLeg(L1, false);
      if (O.boxers) boxers(hip, L0, L1);
      if (O.belt) G.thick(hip[0] - 3, hip[1] - 1, hip[0] + 3, hip[1] - 1, 1, O.belt);
      G.blit(O.head, headC[0], headC[1]);
      if (O.weapon === 'sword') { const e = A1[0], h = A1[1], dx = h[0] - e[0], dy = h[1] - e[1], l = Math.hypot(dx, dy) || 1; G.thick(h[0], h[1], h[0] + dx / l * 9, h[1] + dy / l * 9, 0.6, P.metalL); G.thick(h[0] - dy / l * 2, h[1] + dx / l * 2, h[0] + dy / l * 2, h[1] - dx / l * 2, 0.6, P.gold); }
      drawArm(A1, false);
      if (O.shield) { const h = A1[1]; G.rect(h[0] - 1, h[1] - 6, 5, 10, O.shield); G.rect(h[0] + 1, h[1] - 3, 1, 4, P.red); G.rect(h[0], h[1] - 2, 3, 1, P.red); }
      if (O.weapon === 'scim') { const h = A1[1]; G.thick(h[0], h[1], h[0] + 6, h[1] - 7, 0.7, P.metalL); G.pset(h[0] + 7, h[1] - 8, P.metalL); }
      autoShade(s);
    }, 14, 33);
    return G.outline(s, OUT);
  }
  function boxers(hip, L0, L1) {
    const c = P.white;
    G.disc(hip[0], hip[1] + 0.5, 2.9, c);
    for (const Lg of [L0, L1]) { const k = Lg[0]; G.thick(hip[0], hip[1], hip[0] + (k[0] - hip[0]) * 0.55, hip[1] + (k[1] - hip[1]) * 0.55, 2.1, c); }
    const T = G.T;
    for (let y = -3; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      const X = Math.round(hip[0] + x), Y = Math.round(hip[1] + y);
      if (G.pget(X, Y) !== c) continue;
      if (((X * 3 + Y * 5) % 7) === 0) { G.pset(X, Y, P.straw); if (G.pget(X, Y - 1) === c) G.pset(X, Y - 1, P.leaf); }
    }
    return T;
  }
  const torsoPlate = (base, light, belt) => (hip, sh) => {
    G.thick(hip[0], hip[1] - 1, sh[0], sh[1] + 1, 3.1, base);
    G.thick(hip[0] + 1, hip[1] - 2, sh[0] + 1, sh[1] + 1.5, 1, light);
    G.disc(sh[0] - 1, sh[1] + 0.5, 2.2, base); // pauldron
    if (belt) G.thick(hip[0] - 3, hip[1], hip[0] + 3, hip[1], 1, belt);
  };
  const torsoSkin = (hip, sh) => { G.thick(hip[0], hip[1] - 1, sh[0], sh[1] + 1, 2.7, P.skin); G.pset(sh[0] + 1, sh[1] + 3, P.skinD); };
  const torsoRags = (base, dk) => (hip, sh) => {
    G.thick(hip[0], hip[1], sh[0], sh[1] + 1, 2.9, base);
    for (let i = -3; i <= 3; i += 2) G.pset(hip[0] + i, hip[1] + 2, dk);
    G.pset(sh[0] + 1, sh[1] + 3, dk); G.pset(sh[0] - 1, sh[1] + 5, dk);
  };
  const torsoStripes = (hip, sh) => { G.thick(hip[0], hip[1], sh[0], sh[1] + 1, 2.9, P.white); for (let k = 1; k < 8; k += 2) { const y = sh[1] + k; G.hline(Math.round(sh[0] - 3 + (hip[0] - sh[0]) * k / 8), Math.round(sh[0] + 3 + (hip[0] - sh[0]) * k / 8), Math.round(y), P.red); } };
  const torsoBones = (hip, sh) => {
    G.thick(hip[0], hip[1], sh[0], sh[1], 0.6, P.bone);
    for (let k = 1; k <= 4; k++) { const t = k / 5, x = sh[0] + (hip[0] - sh[0]) * t * 0.8, y = sh[1] + (hip[1] - sh[1]) * t * 0.8; G.hline(Math.round(x - 2.5 + t), Math.round(x + 2.5 - t), Math.round(y), P.bone); }
    G.hline(Math.round(hip[0] - 2), Math.round(hip[0] + 2), Math.round(hip[1]), P.bone);
  };
  const torsoImp = (hip, sh) => { G.thick(hip[0], hip[1], sh[0], sh[1] + 1, 3, P.imp); G.line(sh[0] - 2, sh[1], sh[0] - 5, sh[1] - 3, P.boneD); G.line(sh[0], sh[1] - 1, sh[0] - 2, sh[1] - 5, P.boneD); };

  const OUTFIT = {};
  function buildOutfits() {
    OUTFIT.steel = { thigh: P.metal, shin: P.metal, foot: P.boot, knee: P.metalL, arm: P.metal, hand: P.metalD, torso: torsoPlate(P.metal, P.metalL, P.belt), head: HEADS.steel, legR: 1.9, armR: 1.5 };
    OUTFIT.gold = { thigh: P.gold, shin: P.gold, foot: P.goldD, knee: P.goldL, arm: P.gold, hand: P.goldD, torso: torsoPlate(P.gold, P.goldL, P.capeD), head: HEADS.gold, legR: 1.9, armR: 1.5, cape: P.cape, capeD: P.capeD };
    OUTFIT.boxers = { thigh: P.skin, shin: P.skin, foot: P.skinD, arm: P.skin, hand: P.skin, torso: torsoSkin, head: HEADS.boxers, legR: 1.5, armR: 1.2, boxers: true };
    OUTFIT.zombie = { thigh: P.ragD, shin: P.zskin, foot: P.zskinD, arm: P.zskin, hand: P.zskinD, torso: torsoRags(P.rag, P.ragD), head: HEADS.zombie, legR: 1.5, armR: 1.2 };
    OUTFIT.pirate = { thigh: hex('#3a3050'), shin: P.zskin, foot: P.dark, arm: P.zskin, hand: P.zskinD, torso: torsoStripes, head: HEADS.pirate, legR: 1.5, armR: 1.2 };
    OUTFIT.trooper = { thigh: P.uni, shin: P.uni, foot: P.dark, arm: P.uni, hand: P.zskin, torso: torsoRags(P.uni, hex('#34462a')), head: HEADS.trooper, legR: 1.6, armR: 1.3 };
    OUTFIT.skeleton = { thigh: P.bone, shin: P.bone, foot: P.boneD, arm: P.bone, hand: P.bone, torso: torsoBones, head: HEADS.skull, legR: 0.8, armR: 0.7 };
    OUTFIT.swords = { thigh: P.bone, shin: P.bone, foot: P.boneD, arm: P.bone, hand: P.bone, torso: torsoBones, head: HEADS.turban, legR: 0.8, armR: 0.7, weapon: 'scim' };
    OUTFIT.haunt = { thigh: P.hmetal, shin: P.hmetal, foot: P.hmetalD, knee: P.metal, arm: P.hmetal, hand: P.hmetalD, torso: torsoPlate(P.hmetal, P.metal, P.dark), head: HEADS.haunt, legR: 1.9, armR: 1.5, weapon: 'sword', backShield: hex('#8a6a2a') };
    OUTFIT.imp = { thigh: P.imp, shin: P.imp, foot: P.impD, arm: P.imp, hand: P.impD, torso: torsoImp, head: HEADS.imp, legR: 1.7, armR: 1.3 };
  }

  // ------------------------------------------------------------ poses
  const POSE = {
    idle: { lean: 0.04, legs: [[-0.14, -0.1], [0.16, 0.08]], arms: [[-0.2, 0.3], [0.18, 0.55]] },
    idle2: { lean: 0.02, legs: [[-0.14, -0.1], [0.16, 0.08]], arms: [[-0.25, 0.2], [0.22, 0.65]] },
    run0: { lean: 0.22, legs: [[-0.75, -0.25], [0.85, 0.15]], arms: [[0.8, 1.6], [-0.7, 0.1]] },
    run1: { lean: 0.2, drop: -1, legs: [[-0.25, -1.3], [0.3, 0.2]], arms: [[0.2, 1.0], [-0.1, 0.5]] },
    run2: { lean: 0.22, legs: [[0.85, 0.15], [-0.75, -0.25]], arms: [[-0.7, 0.1], [0.8, 1.6]] },
    run3: { lean: 0.2, drop: -1, legs: [[0.3, 0.2], [-0.25, -1.3]], arms: [[-0.1, 0.5], [0.2, 1.0]] },
    jump: { lean: 0.1, drop: -2, legs: [[0.4, -0.7], [1.2, 0.2]], arms: [[-2.3, -2.7], [2.5, 2.9]] },
    fall: { lean: 0.0, legs: [[-0.35, -0.1], [0.45, 0.3]], arms: [[-1.1, -1.5], [1.2, 1.9]] },
    crouch: { lean: 0.35, drop: 5, legs: [[1.25, -0.25], [1.45, 0.05]], arms: [[0.4, 1.1], [1.1, 1.6]] },
    throw0: { lean: -0.12, legs: [[-0.38, -0.2], [0.38, 0.2]], arms: [[0.5, 1.2], [-2.6, -2.1]] },
    throw1: { lean: 0.28, legs: [[-0.45, -0.25], [0.42, 0.2]], arms: [[-0.6, 0.0], [1.57, 1.57]] },
    throwC: { lean: 0.35, drop: 5, legs: [[1.25, -0.25], [1.45, 0.05]], arms: [[0.4, 1.1], [1.57, 1.57]] },
    throwU: { lean: -0.05, legs: [[-0.3, -0.15], [0.3, 0.15]], arms: [[-0.3, 0.2], [3.1, 3.12]] },
    climb0: { lean: 0.0, legs: [[-0.1, -0.1], [1.0, -0.2]], arms: [[2.9, 3.0], [2.2, 2.9]] },
    climb1: { lean: 0.0, legs: [[1.0, -0.2], [-0.1, -0.1]], arms: [[2.2, 2.9], [2.9, 3.0]] },
    hurt: { lean: -0.5, drop: -1, legs: [[0.6, 1.0], [-0.4, -0.1]], arms: [[2.6, 2.1], [-2.5, -2.9]] },
    zwalk0: { lean: 0.28, legs: [[-0.4, -0.2], [0.45, 0.15]], arms: [[1.35, 1.5], [1.45, 1.62]] },
    zwalk1: { lean: 0.26, drop: -1, legs: [[-0.05, -0.6], [0.15, 0.1]], arms: [[1.3, 1.45], [1.5, 1.6]] },
    zwalk2: { lean: 0.28, legs: [[0.45, 0.15], [-0.4, -0.2]], arms: [[1.4, 1.55], [1.4, 1.58]] },
    zwalk3: { lean: 0.26, drop: -1, legs: [[0.15, 0.1], [-0.05, -0.6]], arms: [[1.45, 1.55], [1.35, 1.5]] },
    slash0: { lean: -0.1, legs: [[-0.4, -0.2], [0.4, 0.2]], arms: [[0.3, 0.9], [-2.4, -1.8]] },
    slash1: { lean: 0.35, legs: [[-0.6, -0.3], [0.7, 0.3]], arms: [[-0.4, 0.2], [1.5, 1.6]] },
  };
  const ARTHUR_FRAMES = ['idle', 'idle2', 'run0', 'run1', 'run2', 'run3', 'jump', 'fall', 'crouch', 'throw0', 'throw1', 'throwC', 'throwU', 'climb0', 'climb1', 'hurt'];
  function buildDolls() {
    for (const o of ['steel', 'gold', 'boxers']) {
      SPR[o] = {};
      for (const f of ARTHUR_FRAMES) {
        const pose = Object.assign({}, POSE[f]);
        if (o === 'gold') pose.cape = f.startsWith('run') ? 3 : f === 'jump' || f === 'fall' ? 5 : 1;
        SPR[o][f] = doll(pose, OUTFIT[o]);
      }
    }
    const walkers = { zombie: 'z', pirate: 'z', trooper: 'z', skeleton: 'r', swords: 'r', haunt: 'r', imp: 'r' };
    for (const k in walkers) {
      SPR[k] = {};
      const w = walkers[k] === 'z' ? ['zwalk0', 'zwalk1', 'zwalk2', 'zwalk3'] : ['run0', 'run1', 'run2', 'run3'];
      SPR[k].walk = w.map(p => doll(Object.assign({}, POSE[p], walkers[k] === 'r' ? { lean: 0.12 } : {}), OUTFIT[k]));
      SPR[k].idle = doll(POSE.idle, OUTFIT[k]);
      SPR[k].throw0 = doll(POSE.throw0, OUTFIT[k]);
      SPR[k].throw1 = doll(POSE.throw1, OUTFIT[k]);
      SPR[k].slash0 = doll(POSE.slash0, OUTFIT[k]);
      SPR[k].slash1 = doll(POSE.slash1, OUTFIT[k]);
      SPR[k].jump = doll(POSE.jump, OUTFIT[k]);
      SPR[k].crouch = doll(POSE.crouch, OUTFIT[k]);
    }
    // Arthur's bones for the death animation
    SPR.arthurBones = doll(POSE.hurt, OUTFIT.skeleton);
  }

  // ------------------------------------------------------------ Red Arremer (painter)
  function arremer(pal, phase) {
    const s = G.makeSprite(30, 28, () => {
      const cx = 15, cy = 15;
      const wingSet = phase === 'up' ? [-1.9, -2.3, -2.7] : phase === 'mid' ? [-2.45, -2.8, -3.1] : phase === 'down' ? [-2.95, -3.3, -3.6] : [-2.9, -3.05, -3.2];
      const lens = phase === 'fold' ? [8, 7, 6] : [13, 11, 9];
      const shx = cx - 1, shy = cy - 5;
      const wing = (dx, dy, col, sc) => {
        const tips = wingSet.map((a, i) => [shx + dx + Math.cos(a) * lens[i] * sc, shy + dy + Math.sin(a) * lens[i] * sc]);
        const pts = [shx + dx, shy + dy];
        for (let i = 0; i < 3; i++) { pts.push(tips[i][0], tips[i][1]); const nx = i < 2 ? (tips[i][0] + tips[i + 1][0]) / 2 : shx + dx - 2, ny = i < 2 ? (tips[i][1] + tips[i + 1][1]) / 2 : shy + dy + 6; pts.push(nx + (shx + dx - nx) * 0.25, ny + (shy + dy + 3 - ny) * 0.25); }
        G.poly(pts, col);
        for (const t of tips) G.line(shx + dx, shy + dy, t[0], t[1], shade(col, 0.6));
      };
      wing(3, -1, shade(pal.wing, 0.75), 0.9);
      // tail
      G.thick(cx - 3, cy + 5, cx - 9, cy + 8, 1, pal.body); G.thick(cx - 9, cy + 8, cx - 11, cy + 5, 0.8, pal.body); G.pset(cx - 11, cy + 4, pal.horn);
      // legs
      G.thick(cx - 1, cy + 5, cx - 2, cy + 11, 1.3, pal.bodyD); G.thick(cx + 2, cy + 5, cx + 3, cy + 11, 1.3, pal.body);
      G.hline(cx - 4, cx - 1, cy + 11, pal.horn); G.hline(cx + 2, cx + 5, cy + 11, pal.horn);
      // body
      G.ellipse(cx, cy, 4.6, 6.5, pal.body);
      G.ellipse(cx + 1.5, cy + 1, 2, 4, pal.belly);
      // head
      G.disc(cx + 3, cy - 8, 3.6, pal.body);
      G.line(cx + 1, cy - 11, cx - 2, cy - 15, pal.horn); G.line(cx + 4, cy - 11, cx + 3, cy - 15, pal.horn);
      G.pset(cx + 5, cy - 9, pal.eye); G.pset(cx + 6, cy - 9, pal.eye);
      G.hline(cx + 4, cx + 7, cy - 6, pal.bodyD); G.pset(cx + 6, cy - 5, hex('#ffffff'));
      // arms & claws
      G.thick(cx + 2, cy - 3, cx + 7, cy, 1.1, pal.body); G.line(cx + 7, cy, cx + 9, cy - 1, pal.horn); G.line(cx + 7, cy, cx + 9, cy + 1, pal.horn);
      wing(0, 0, pal.wing, 1);
      autoShade(G.T);
    }, 15, 27);
    return G.outline(s, OUT);
  }
  function buildArremers() {
    const pals = {
      red: { body: hex('#d22a2a'), bodyD: hex('#7c1010'), belly: hex('#ff6a4a'), wing: hex('#4a3464'), horn: hex('#f0e8c8'), eye: hex('#ffe040') },
      stone: { body: hex('#8a8a96'), bodyD: hex('#4e4e5a'), belly: hex('#b0b0ba'), wing: hex('#5c5c68'), horn: hex('#d8d8e0'), eye: hex('#ff4020') },
      ace: { body: hex('#9a1030'), bodyD: hex('#4a0414'), belly: hex('#ff4060'), wing: hex('#1c1024'), horn: hex('#ffd040'), eye: hex('#40ffff') },
    };
    for (const k in pals) {
      SPR['arremer_' + k] = { up: arremer(pals[k], 'up'), mid: arremer(pals[k], 'mid'), down: arremer(pals[k], 'down'), fold: arremer(pals[k], 'fold') };
    }
    const a = SPR.arremer_ace; SPR.ace = { up: scale(a.up, 1.5), mid: scale(a.mid, 1.5), down: scale(a.down, 1.5), fold: scale(a.fold, 1.5) };
  }

  // ------------------------------------------------------------ small creatures (ASCII)
  function buildCreatures() {
    const lp = { g: hex('#3ee03a'), s: P.skin, b: hex('#3858f0'), w: P.white, r: P.red, k: P.dark };
    SPR.lemming = {
      walk: [
        asc(['..gg....', '.gggg...', '.gssg...', '..ss....', '.bbb....', '.bbbs...', '..bb....', '..bb....', '.b..b...', 'ss...s..'], lp, 3, 9),
        asc(['..gg....', '.gggg...', '.gssg...', '..ss....', '.bbb....', 'sbbb....', '..bb....', '..bb....', '..bb....', '..ss....'], lp, 3, 9)],
      block: asc(['...gg...', '..gggg..', '..gssg..', '...ss...', 'sbbbbbbs', '..bbbb..', '..bbbb..', '..b..b..', '..b..b..', '.ss..ss.'], lp, 4, 9),
      ohno: asc(['.s.gg.s.', '.sgggg s', '..gssg..', '...ss...', '..bbbb..', '..bbbb..', '..bbbb..', '..b..b..', '..b..b..', '.ss..ss.'].map(r => r.replace(' ', '.')), lp, 4, 9),
    };
    const bp = { k: hex('#2a1a3a'), p: hex('#6a3a8a'), r: P.eye };
    SPR.bat = [
      asc(['k.........k..', 'kk.......kk..', 'pkk.kpk.kkp..', '.pkkkrkkkp...', '..ppkkkpp....', '....kpk......'], bp, 6, 3),
      asc(['.....kpk.....', '...ppkkkpp...', '.ppkkkrkkkpp.', 'pp..kkkk..pp.', 'p....kk....p.', '.............'], bp, 6, 3)];
    const sk = { w: P.bone, k: P.dark, g: hex('#40ff60') };
    SPR.skull = [
      asc(['..wwwwww..', '.wwwwwwww.', 'wwwwwwwwww', 'wwkkwwkkww', 'wwkgwwgkww', 'wwwwkkwwww', '.wwwwwwww.', '..wkwkwk..', '..wwwwww..', '..........'], sk, 5, 5),
      asc(['..wwwwww..', '.wwwwwwww.', 'wwwwwwwwww', 'wwkkwwkkww', 'wwkgwwgkww', 'wwwwkkwwww', '.wwwwwwww.', '..wkwkwk..', '..........', '..wwwwww..'], sk, 5, 5)];
    const ep = { g: hex('#3a8a6a'), G: hex('#7ad0a0'), k: P.dark, r: P.eye, f: hex('#c0e040'), w: P.white };
    SPR.eel = [
      asc(['.......ffff.......', '.....gggggggg.....', '..gggGGGGGGGgggrg.', 'fgggggggggggggggww', 'ffgggggggggggggkk.', '.f..gggggggggg....', '.......ff.........'], ep, 9, 3),
      asc(['.......ffff.......', '.....gggggggg.....', '..gggGGGGGGGgggrg.', 'fgggggggggggggggkk', '.fgggggggggggggww.', 'ff..gggggggggg....', '........ff........'], ep, 9, 3)];
    SPR.bonePile = asc(['......w.....', '..w..www.w..', '.wwwkwwwwww.', 'wwwwwwwwwwww'], { w: P.bone, k: P.dark }, 6, 3);
  }

  // ------------------------------------------------------------ objects & items
  function chest(kind, open) {
    const body = kind === 'm' ? hex('#6a36a6') : hex('#8e5a2a'), bodyD = shade(body, 0.6), band = hex('#f0c848');
    const s = G.makeSprite(18, 16, () => {
      G.rect(1, 7, 16, 8, body);
      for (let x = 2; x < 17; x += 4) G.rect(x, 7, 1, 8, bodyD);
      G.rect(3, 7, 2, 8, band); G.rect(13, 7, 2, 8, band);
      if (!open) {
        G.rect(1, 3, 16, 4, body); G.rect(2, 2, 14, 1, body); G.rect(3, 3, 2, 4, band); G.rect(13, 3, 2, 4, band);
        G.rect(7, 5, 4, 4, band); G.pset(8, 7, P.dark); G.pset(9, 7, P.dark);
      } else {
        G.rect(1, 6, 16, 2, P.yellow); G.rect(2, 0, 14, 3, body); G.rect(3, 0, 2, 3, band); G.rect(13, 0, 2, 3, band);
      }
      if (kind === 'm') { G.pset(6, 11, P.yellow); G.pset(11, 12, P.yellow); G.pset(9, 9, P.white); }
      autoShade(G.T);
    }, 9, 15);
    return G.outline(s, OUT);
  }
  function buildItems() {
    SPR.chest = { T: [chest('T', false), chest('T', true)], m: [chest('m', false), chest('m', true)] };
    const armorIcon = (m, l, d) => finish(G.makeSprite(16, 15, () => {
      G.poly([3, 3, 12, 3, 13, 9, 11, 13, 4, 13, 2, 9], m);
      G.disc(2.5, 4, 2.2, m); G.disc(12.5, 4, 2.2, m);
      G.line(7, 4, 7, 12, d); G.line(5, 5, 5, 10, l);
      G.rect(4, 11, 7, 1, d);
    }, 8, 14));
    SPR.armorItem = armorIcon(P.metal, P.metalL, P.metalD);
    SPR.goldItem = armorIcon(P.gold, P.goldL, P.goldD);
    // weapons (horizontal, pointing right)
    SPR.w_lance = finish(G.makeSprite(18, 5, () => { G.rect(0, 2, 13, 1, hex('#c8b89a')); G.rect(2, 1, 3, 3, P.red); G.poly([12, 0, 17, 2, 12, 4], P.metalL); }, 9, 2), false);
    SPR.w_lanceL = finish(G.makeSprite(24, 5, () => { G.rect(0, 2, 18, 1, hex('#d8c8a0')); G.rect(3, 1, 4, 3, P.red); G.poly([17, 0, 23, 2, 17, 4], P.metalL); G.pset(19, 1, P.white); }, 12, 2), false);
    SPR.w_dagger = finish(G.makeSprite(11, 5, () => { G.rect(0, 1, 3, 3, P.belt); G.rect(3, 0, 1, 5, P.gold); G.poly([4, 1, 10, 2, 4, 3], P.metalL); }, 5, 2), false);
    SPR.w_torch = finish(G.makeSprite(8, 10, () => { G.rect(2, 4, 4, 6, hex('#3a70d0')); G.rect(3, 5, 1, 3, hex('#a0d0ff')); G.rect(3, 2, 2, 2, P.belt); G.disc(4, 1, 1.5, hex('#60c0ff')); }, 4, 5));
    SPR.w_axe = finish(G.makeSprite(12, 12, () => { G.thick(2, 10, 8, 2, 0.8, P.belt); G.poly([6, 0, 11, 1, 11, 6, 8, 5, 7, 3], P.metal); G.line(11, 1, 11, 6, P.metalL); }, 6, 6));
    SPR.w_cross = finish(G.makeSprite(12, 12, () => { G.rect(4, 0, 4, 12, P.gold); G.rect(0, 4, 12, 4, P.gold); G.rect(5, 5, 2, 2, P.red); }, 6, 6));
    SPR.bone = finish(G.makeSprite(8, 8, () => { G.thick(1.5, 6.5, 6.5, 1.5, 0.7, P.bone); G.disc(1, 7, 1.2, P.bone); G.disc(2, 6.5, 1, P.bone); G.disc(7, 1, 1.2, P.bone); G.disc(6.5, 2, 1, P.bone); }, 4, 4), false);
    SPR.fireball = [0, 1].map(k => G.makeSprite(10, 10, () => { G.disc(5, 5, 4.2, hex('#c02000')); G.disc(5 + k, 5, 3, hex('#ff8a10')); G.disc(5 + k, 4.5, 1.6, hex('#fff080')); }, 5, 5));
    SPR.ghostfire = [0, 1].map(k => G.makeSprite(10, 10, () => { G.disc(5, 5, 4.2, hex('#107a40')); G.disc(5 - k, 5, 3, hex('#40f090')); G.disc(5 - k, 4.5, 1.5, hex('#e0fff0')); }, 5, 5));
    SPR.acid = G.makeSprite(6, 6, () => { G.disc(3, 3, 2.5, hex('#90e020')); G.pset(2, 2, hex('#f0ffa0')); }, 3, 3);
    SPR.cannonball = finish(G.makeSprite(8, 8, () => { G.disc(4, 4, 3.3, hex('#2a2a34')); G.pset(3, 2, hex('#9a9ab0')); }, 4, 4), false);
    SPR.bluefire = [0, 1, 2].map(k => G.makeSprite(8, 12, () => {
      const h = 9 + (k === 1 ? 2 : k === 2 ? -1 : 0);
      G.poly([0, 11, 4, 11 - h, 8, 11], hex('#2050e0')); G.poly([2, 11, 4 + (k - 1), 11 - h * 0.65, 6, 11], hex('#60b0ff')); G.poly([3, 11, 4, 11 - h * 0.35, 5, 11], hex('#e0f4ff'));
    }, 4, 11));
    SPR.bag = finish(G.makeSprite(12, 12, () => { G.disc(6, 7.5, 4.3, hex('#a07030')); G.rect(4, 1, 4, 3, hex('#a07030')); G.hline(3, 8, 3, P.gold); G.text('$', 4, 4, P.gold); }, 6, 11));
    SPR.gem = finish(G.makeSprite(10, 10, () => { G.poly([1, 3, 3, 0, 7, 0, 9, 3, 5, 9], hex('#30d8f0')); G.poly([3, 0, 5, 3, 7, 0], hex('#b0ffff')); }, 5, 9));
    SPR.potion = finish(G.makeSprite(9, 12, () => { G.disc(4.5, 7.5, 3.8, hex('#e02040')); G.rect(3, 1, 3, 4, hex('#c0d8ff')); G.rect(3, 0, 3, 1, P.belt); G.pset(3, 6, P.white); }, 4, 11));
    SPR.floppy = finish(G.makeSprite(12, 12, () => { G.rect(0, 0, 12, 12, hex('#2a3aa0')); G.rect(3, 0, 6, 4, hex('#c8ccd8')); G.rect(6, 1, 2, 2, hex('#2a3aa0')); G.rect(2, 6, 8, 6, P.white); G.hline(3, 8, 8, hex('#e03030')); G.pset(0, 0, 0); }, 6, 11), false);
    SPR.cursedFloppy = finish(G.makeSprite(18, 18, () => { G.rect(0, 0, 18, 18, hex('#700a1a')); G.rect(4, 0, 9, 6, hex('#c8ccd8')); G.rect(9, 1, 3, 4, hex('#700a1a')); G.rect(2, 9, 14, 9, hex('#f0e0c0')); G.blit(HEADS.skull, 9, 13); }, 9, 17), false);
    SPR.anvil = {};
    for (const [k, m, l, d] of [['steel', P.metal, P.metalL, P.metalD], ['gold', P.gold, P.goldL, P.goldD]]) {
      SPR.anvil[k] = finish(G.makeSprite(22, 16, () => {
        G.poly([3, 15, 18, 15, 16, 12, 5, 12], hex('#2c2c36'));
        G.rect(7, 9, 8, 3, hex('#3c3c48'));
        G.poly([1, 6, 21, 6, 19, 9, 3, 9], hex('#4a4a5a')); G.poly([21, 6, 22, 7, 19, 8], hex('#4a4a5a'));
        G.poly([4, 7, 10, 7, 11, 1, 3, 1], m); G.line(5, 2, 5, 6, l);
        G.blit(k === 'gold' ? HEADS.gold : HEADS.steel, 15, 2);
      }, 11, 15));
    }
    SPR.cannon = finish(G.makeSprite(20, 12, () => { G.rect(3, 2, 14, 6, hex('#2e2e3c')); G.rect(0, 1, 4, 8, hex('#3e3e50')); G.disc(10, 9, 2.6, hex('#6a4020')); G.rect(16, 3, 3, 4, hex('#16161e')); }, 10, 11));
    SPR.barrel = finish(G.makeSprite(12, 15, () => { G.rect(1, 2, 10, 13, hex('#5a6a4a')); G.rect(1, 5, 10, 1, hex('#3a4a2a')); G.rect(1, 10, 10, 1, hex('#3a4a2a')); G.ellipse(6, 2, 5, 1.6, hex('#50ff40')); G.text('!', 4, 6, P.yellow); }, 6, 14));
    SPR.hatch = finish(G.makeSprite(28, 10, () => { G.rect(0, 0, 28, 6, hex('#8a6a3a')); G.rect(4, 5, 20, 5, hex('#1a1210')); G.rect(0, 0, 28, 1, hex('#c8a060')); }, 14, 0), false);
    SPR.flag = finish(G.makeSprite(12, 26, () => { G.rect(1, 0, 1, 26, hex('#c8c8d8')); G.poly([2, 1, 11, 4, 2, 8], P.red); }, 1, 25));
    SPR.flagOn = finish(G.makeSprite(12, 26, () => { G.rect(1, 0, 1, 26, hex('#c8c8d8')); G.poly([2, 1, 11, 4, 2, 8], P.yellow); }, 1, 25));
  }

  // ------------------------------------------------------------ bosses
  function buildBosses() {
    // --- LeChuck's ghost captain
    const gG = hex('#5ae0a0'), gD = hex('#1e8a5a'), gL = hex('#c8ffe4');
    SPR.ghostCap = [0, 1].map(open => finish(G.makeSprite(64, 64, () => {
      G.poly([10, 30, 54, 30, 60, 63, 46, 56, 38, 63, 30, 56, 20, 63, 12, 56, 4, 63], gD);
      G.ellipse(32, 36, 22, 18, gG);
      G.poly([14, 44, 50, 44, 44, 60, 38, 54, 32, 62, 26, 54, 20, 60], hex('#2a6a4a')); // beard
      G.ellipse(32, 26, 15, 13, gL);
      G.disc(26, 24, 3.2, P.dark); G.disc(38, 24, 3.2, P.dark); G.disc(26, 24, 1.6, P.eye); G.disc(38, 24, 1.6, P.eye);
      G.ellipse(32, 34, 6, open ? 5 : 2, P.dark);
      if (open) { G.hline(27, 37, 30, P.white); }
      G.poly([6, 16, 32, 4, 58, 16, 50, 14, 32, 12, 14, 14], hex('#1a1624')); G.rect(14, 12, 36, 4, hex('#1a1624'));
      G.blit(HEADS.skull, 32, 9);
    }, 32, 40)));
    SPR.ghostHand = [0, 1].map(fist => finish(G.makeSprite(24, 20, () => {
      G.ellipse(12, 12, 8, 6, gG);
      if (fist) for (let i = 0; i < 4; i++) G.disc(6 + i * 4, 7, 2.3, gG);
      else for (let i = 0; i < 4; i++) G.thick(6 + i * 4, 9, 4 + i * 5, 1, 1.4, gG);
      G.thick(19, 13, 23, 8, 1.4, gG);
    }, 12, 10)));
    // --- Daventry moat dragon
    const dg = hex('#3a9a4a'), dgD = hex('#1e5a2a'), dgL = hex('#a0e070');
    SPR.dragonHead = [0, 1].map(open => finish(G.makeSprite(36, 26, () => {
      G.ellipse(14, 12, 12, 9, dg);
      G.poly([18, 6, 35, open ? 4 : 9, 34, 12, 20, 14], dg);
      if (open) { G.poly([20, 15, 35, 22, 33, 14], dg); G.poly([20, 12, 33, 12, 33, 18], hex('#6a0a10')); for (let x = 22; x < 34; x += 3) G.pset(x, 12, P.white); }
      else G.poly([20, 14, 34, 12, 33, 15, 20, 17], dg);
      G.line(8, 4, 2, -2, P.bone); G.line(12, 3, 9, -3, P.bone);
      G.disc(19, 8, 2, P.yellow); G.pset(20, 8, P.dark);
      for (let i = 0; i < 5; i++) G.pset(6 + i * 3, 17, dgL);
    }, 12, 13)));
    SPR.dragonSeg = finish(G.makeSprite(16, 16, () => { G.disc(8, 8, 7, dg); G.disc(9, 9, 4, dgL); G.pset(4, 5, dgD); G.pset(11, 4, dgD); G.poly([6, 1, 8, -3, 10, 1], hex('#d0a040')); }, 8, 8));
    // --- Jaffar
    const robe = hex('#4a1a72'), robeD = hex('#260a40');
    SPR.jaffar = ['stand', 'cast', 'hurt'].map(st => finish(G.makeSprite(34, 46, () => {
      G.poly([9, 45, 25, 45, 21, 16, 13, 16], robe); G.poly([12, 45, 17, 45, 17, 18, 14, 18], robeD);
      G.poly([6, 20, 28, 20, 26, 16, 8, 16], robe); // shoulders/cape
      const arm = st === 'cast' ? [[10, 18, 4, 6], [24, 18, 30, 6]] : st === 'hurt' ? [[10, 18, 4, 12], [24, 18, 30, 12]] : [[10, 18, 9, 30], [24, 18, 26, 30]];
      for (const [a, b, c, d] of arm) { G.thick(a, b, c, d, 1.8, robe); G.disc(c, d, 1.6, P.skin); }
      G.disc(17, 11, 4.6, hex('#c89060'));
      G.poly([13, 13, 21, 13, 17, 24], hex('#141018'));
      G.ellipse(17, 6, 6.5, 4, hex('#f0e8f8')); G.rect(11, 6, 13, 2, hex('#f0e8f8')); G.disc(17, 5, 1.4, P.red); G.poly([17, 1, 16, -3, 19, 0], hex('#f0e8f8'));
      G.pset(15, 10, P.dark); G.pset(19, 10, P.dark);
      autoShade(G.T);
    }, 17, 45)));
    // --- 10-ton Lemming crusher engine
    SPR.engine = [0, 1].map(open => finish(G.makeSprite(100, 110, () => {
      G.rect(6, 10, 88, 100, hex('#3a3440'));
      for (let y = 14; y < 108; y += 12) for (let x = 10; x < 92; x += 12) G.pset(x, y, hex('#7a7488'));
      G.rect(0, 0, 100, 12, hex('#5a5260')); G.rect(0, 12, 100, 2, hex('#1a1620'));
      G.rect(20, 40, 60, 46, hex('#1a1418'));
      if (open) { G.ellipse(50, 63, 22, 18, hex('#ff5a10')); G.ellipse(50, 63, 14, 11, hex('#ffd040')); G.ellipse(50, 63, 6, 5, hex('#fff8e0')); }
      else for (let x = 22; x < 80; x += 6) G.rect(x, 42, 3, 42, hex('#6a5a50'));
      G.rect(24, 18, 52, 14, hex('#c8a030')); G.text('10 TON', 32, 22, hex('#1a1418'));
      G.rect(0, 96, 100, 14, hex('#2a2430'));
    }, 50, 109), false));
    SPR.pistonHead = finish(G.makeSprite(32, 14, () => { G.rect(0, 0, 32, 12, hex('#6a6478')); G.rect(0, 10, 32, 4, hex('#403a48')); for (let x = 2; x < 32; x += 6) G.poly([x, 13, x + 3, 13, x + 1.5, 16], hex('#c8c8d8')); G.rect(0, 0, 32, 2, hex('#a8a2b8')); }, 16, 13));
    // --- Astaroth-LeChuck-9000
    const ab = hex('#3a6e8e'), abD = hex('#1e3a52'), abL = hex('#7ab4d4');
    SPR.astaroth = [0, 1].map(open => finish(G.makeSprite(128, 112, () => {
      G.rect(14, 20, 100, 92, hex('#3a1a2a')); G.rect(10, 10, 108, 14, hex('#6a2a3a')); // throne
      G.poly([28, 110, 100, 110, 94, 50, 34, 50], ab); // body
      G.ellipse(64, 70, 30, 26, ab);
      G.ellipse(64, 72, 20, 17, abL); // belly face
      G.disc(56, 64, 3.5, P.dark); G.disc(72, 64, 3.5, P.dark); G.disc(56, 64, 1.8, P.yellow); G.disc(72, 64, 1.8, P.yellow);
      G.ellipse(64, 78, 11, open ? 8 : 2.5, hex('#300008'));
      if (open) { for (let x = 55; x < 74; x += 4) G.poly([x, 70, x + 2, 70, x + 1, 74], P.white); G.disc(64, 80, 3, hex('#ff6010')); }
      G.thick(34, 56, 14, 86, 7, ab); G.thick(94, 56, 114, 86, 7, ab); // arms
      G.disc(14, 90, 8, abD); G.disc(114, 90, 8, abD);
      G.ellipse(64, 38, 16, 14, ab); // head
      G.poly([50, 30, 36, 4, 54, 26], P.bone); G.poly([78, 30, 92, 4, 74, 26], P.bone);
      G.disc(58, 38, 2.5, P.eye); G.disc(70, 38, 2.5, P.eye);
      G.hline(56, 72, 46, abD);
    }, 64, 111)));
    SPR.lechuck = [0, 1].map(k => finish(G.makeSprite(48, 50, () => {
      for (let i = 0; i < 7; i++) { const x = 6 + i * 6, h = 12 + ((i + k) % 3) * 5; G.poly([x - 4, 18, x, 18 - h, x + 4, 18], i % 2 ? hex('#ff9020') : hex('#40f0a0')); }
      G.ellipse(24, 26, 16, 14, hex('#9ae8c0'));
      G.poly([10, 30, 38, 30, 34, 48, 28, 42, 24, 50, 20, 42, 14, 48], hex('#2a4a3a'));
      G.disc(18, 23, 3, P.dark); G.disc(30, 23, 3, P.dark); G.disc(18, 23, 1.5, P.eye); G.disc(30, 23, 1.5, P.eye);
      G.hline(18, 30, 32, P.dark);
    }, 24, 26)));
    SPR.core9000 = [0, 1].map(k => finish(G.makeSprite(60, 66, () => {
      G.rect(4, 2, 52, 62, hex('#d8cfb0')); G.rect(4, 2, 52, 3, hex('#f4ecd4')); G.rect(52, 2, 4, 62, hex('#a89e80'));
      G.rect(10, 8, 40, 30, hex('#1a1a20'));
      G.disc(30, 23, 11, hex('#3a0808')); G.disc(30, 23, 8, k ? hex('#ff2010') : hex('#c00808')); G.disc(30, 23, 4, k ? hex('#ffd080') : hex('#ff5030')); G.pset(28, 20, P.white);
      G.rect(12, 44, 36, 3, hex('#1a1a20')); G.rect(14, 45, 32, 1, hex('#50505a'));
      G.text('9000', 18, 52, hex('#6a6048'));
      G.rect(44, 52, 4, 3, k ? hex('#40ff40') : hex('#205020'));
    }, 30, 33)));
  }

  function build() {
    buildHeads(); buildOutfits(); buildDolls(); buildArremers(); buildCreatures(); buildItems(); buildBosses();
    SPR.heads = HEADS; SPR.P = P;
  }
  return { build, scale, recolor, autoShade, finish, OUT };
})();
