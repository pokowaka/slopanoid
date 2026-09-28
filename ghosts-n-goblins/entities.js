'use strict';
/* =============================================================================
 *  GHOSTS 'N GOBLINS · THE CURSED PC GAMING MUSEUM — entities.js
 *  Enemy, trap and boss behaviours. Each definition is a small state machine
 *  that talks to the game through the sim context `S` (bound by game.js):
 *    S.P, S.t, S.diff, S.target(e), S.moveBody(e), S.solidAt(x,y), S.tileAt(x,y)
 *    S.spawn(type,x,y,o), S.eshot(o), S.fx(kind,x,y,n), S.explode(x,y,r,src)
 *    S.hurtPlayer(src), S.addScore(n,x,y), S.sfx(n), S.shake(n), S.flash(k)
 *    S.drop(x,y,kind), S.bossDefeated(e), S.anvil, S.pshots, S.ents, S.arena
 *  Entity coordinates: x = centre, y = feet (bosses: sprite anchor).
 * ===========================================================================*/
const Ents = (() => {
  const G = GFX;
  let S = null;
  const D = {};
  let nextId = 1;
  const PI = Math.PI;
  const sgn = v => (v < 0 ? -1 : 1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = () => Math.random();

  function create(type, x, y, o = {}) {
    const d = D[type]; if (!d) return null;
    const e = {
      id: nextId++, type, def: d, x, y, vx: 0, vy: 0, w: d.w || 7, h: d.h || 26, hp: d.hp || 1, face: o.face || -1,
      t: 0, st: 'init', stt: 0, flash: 0, o, score: d.score || 100, kind: d.kind || 'undead', boss: !!d.boss,
      harmless: !!d.harmless, inv: !!d.inv, poss: d.poss || null, fly: !!d.fly, heavy: !!d.heavy, onGround: false, dist: 0, name: d.name || '',
    };
    if (d.init) d.init(e, S);
    e.hp = Math.round(e.hp * (e.boss ? S.diff : 1) * 10) / 10;
    e.maxhp = e.hp;
    return e;
  }
  const faceTo = (e, tx) => { e.face = tx < e.x ? -1 : 1; };
  const tgt = e => S.target(e);
  const setSt = (e, st) => { e.st = st; e.stt = 0; };
  const mode = e => (e.flash > 0 && (e.flash & 2) ? 1 : 0);
  function doll(e, set, frame, X, Y, extraMode, arg) {
    const s = SPR[set][frame] || SPR[set].idle;
    G.blit(s, X, Y, e.face < 0, extraMode != null ? extraMode : mode(e), arg);
  }
  function walkFrame(e) { return ((e.dist / 5) | 0) & 3; }
  function blockedAhead(e) {
    const ax = e.x + e.face * (e.w + 2);
    if (S.solidAt(ax, e.y - 4) || S.solidAt(ax, e.y - e.h + 4)) return true;
    for (const o of S.ents) if (o !== e && (o.type === 'blocker') && !o.dead && Math.abs(o.x - ax) < 6 && Math.abs(o.y - e.y) < 10) return true;
    return false;
  }
  const edgeAhead = e => !S.solidAt(e.x + e.face * (e.w + 3), e.y + 3);
  function walk(e, spd, turnEdges = true) {
    e.vx = e.face * spd;
    S.moveBody(e);
    e.dist += Math.abs(e.vx);
    if (e.onGround && (blockedAhead(e) || (turnEdges && edgeAhead(e)))) { e.face = -e.face; e.x += e.face; }
  }
  function aimShot(x, y, tx, ty, spd) { const a = Math.atan2(ty - y, tx - x); return [Math.cos(a) * spd, Math.sin(a) * spd]; }
  function spray(e, x, y, n, spread, spd, spr, extra = {}) {
    const T = tgt(e) || { x: x + e.face * 100, y };
    const a0 = Math.atan2(T.y - 12 - y, T.x - x);
    for (let i = 0; i < n; i++) {
      const a = a0 + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
      S.eshot(Object.assign({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, spr, r: 4, life: 240 }, extra));
    }
  }

  // ============================================================ ZOMBIES
  const ZVAR = { zombie: { hp: 1, spd: 0.45 }, pirate: { hp: 2, spd: 0.55 }, trooper: { hp: 2, spd: 0.7 } };
  D.zombie = {
    hp: 1, w: 6, h: 26, score: 100, poss: 'zombie',
    init(e) { const v = e.o.v || 'zombie'; e.v = v; e.hp = ZVAR[v].hp; e.spd = ZVAR[v].spd * (0.9 + rnd() * 0.25); e.st = e.o.noRise ? 'walk' : 'rise'; const T = tgt(e); if (T) faceTo(e, T.x); e.life = 420 + rnd() * 200; e.noHarm = e.st === 'rise'; if (e.st === 'rise') S.sfx('crumble'); },
    draw() {},
    update(e) {
      e.stt++;
      if (e.st === 'rise') {
        e.noHarm = e.stt < 26; e.untargetable = e.stt < 14;
        if (e.stt % 6 === 0) S.fx('dust', e.x + (rnd() - 0.5) * 12, e.y, 2);
        if (e.stt >= 40) setSt(e, 'walk');
        return;
      }
      if (e.st === 'sink') { e.noHarm = true; if (e.stt >= 40) e.dead = true; return; }
      const T = tgt(e);
      if (T) { if (sgn(T.x - e.x) !== e.face && Math.abs(T.x - e.x) > 40) { e.behind = (e.behind || 0) + 1; if (e.behind > 100) { e.face = -e.face; e.behind = 0; } } else e.behind = 0; }
      walk(e, e.spd * S.diff);
      if (e.v === 'trooper' && T && e.stt % 170 === 90 && Math.abs(T.x - e.x) < 170 && sgn(T.x - e.x) === e.face && S.onScreen(e.x, 0)) {
        S.eshot({ x: e.x + e.face * 8, y: e.y - 18, vx: e.face * 2, vy: 0, spr: SPR.ghostfire, r: 4, life: 150 }); S.sfx('fire');
      }
      if (e.stt > e.life && e.onGround) setSt(e, 'sink');
    },
  };
  D.zombie.draw = function (e, X, Y) {
    if (e.st === 'rise' || e.st === 'sink') {
      const k = e.st === 'rise' ? Math.min(1, e.stt / 36) : 1 - e.stt / 40;
      G.blit(k < 0.8 ? SPR[e.v].crouch : SPR[e.v].walk[0], X, Y + (1 - k) * 30, e.face < 0, mode(e), 0, Y);
      return;
    }
    G.blit(SPR[e.v].walk[walkFrame(e)], X, Y, e.face < 0, mode(e));
  };

  // ============================================================ SKELETONS
  D.skeleton = {
    hp: 2, w: 5, h: 26, score: 200, kind: 'bone', poss: 'skeleton',
    init(e) { e.st = 'rise'; e.cd = 60 + rnd() * 60; },
    update(e) {
      e.stt++;
      if (e.st === 'rise') { e.noHarm = true; e.untargetable = e.stt < 10; if (e.stt > 30) { e.noHarm = false; setSt(e, 'walk'); } S.moveBody(e); return; }
      const T = tgt(e);
      if (T) faceTo(e, T.x);
      const d = T ? Math.abs(T.x - e.x) : 999;
      if (e.st === 'walk') {
        const spd = d < 50 ? -0.4 : d > 110 ? 0.5 : 0;
        e.vx = e.face * spd; S.moveBody(e); e.dist += Math.abs(e.vx);
        if (e.onGround && spd !== 0 && (S.solidAt(e.x + sgn(e.vx) * 8, e.y - 6) || !S.solidAt(e.x + sgn(e.vx) * 8, e.y + 3))) e.vx = 0;
        if (--e.cd <= 0 && T && d < 170 && S.onScreen(e.x, 0)) setSt(e, 'throw');
      } else if (e.st === 'throw') {
        e.vx = 0; S.moveBody(e);
        if (e.stt === 18 && T) {
          const vx = clamp((T.x - e.x) / 42, -2.6, 2.6);
          S.eshot({ x: e.x + e.face * 6, y: e.y - 24, vx, vy: -3.3, grav: 0.15, spr: SPR.bone, r: 4, life: 200, rot: 0.3 * sgn(vx), kind: 'bone' });
          S.sfx('throw');
        }
        if (e.stt > 34) { setSt(e, 'walk'); e.cd = (70 + rnd() * 50) / S.diff; }
      }
    },
    draw(e, X, Y) {
      if (e.st === 'rise') { const k = Math.min(1, e.stt / 28); if (k < 0.5) G.blit(SPR.bonePile, X, Y); else G.blit(SPR.skeleton.crouch, X, Y, e.face < 0, mode(e)); return; }
      const f = e.st === 'throw' ? (e.stt < 18 ? 'throw0' : 'throw1') : null;
      if (f) doll(e, 'skeleton', f, X, Y); else G.blit(SPR.skeleton.walk[walkFrame(e)], X, Y, e.face < 0, mode(e));
    },
  };
  D.swords = {
    hp: 4, w: 6, h: 26, score: 400, kind: 'bone', poss: 'skeleton',
    init(e) { e.st = 'walk'; e.cd = 0; },
    update(e) {
      e.stt++;
      const T = tgt(e);
      const d = T ? T.x - e.x : 999;
      if (e.st === 'walk') {
        if (T) faceTo(e, T.x);
        if (T && Math.abs(d) < 26 && Math.abs(T.y - e.y) < 24) setSt(e, 'wind');
        else if (T && Math.abs(d) < 200) { e.vx = e.face * 0.6 * S.diff; S.moveBody(e); e.dist += 0.6; if (e.onGround && edgeAhead(e)) e.x -= e.vx; }
        else S.moveBody(e);
        if (T && e.stt > 220 && Math.abs(d) < 120 && Math.abs(d) > 50 && e.onGround) { e.vy = -4.2; e.vx = sgn(d) * 1.6; setSt(e, 'leap'); S.sfx('jump'); }
      } else if (e.st === 'leap') { S.moveBody(e); if (e.onGround && e.stt > 5) { e.vx = 0; setSt(e, 'wind'); } }
      else if (e.st === 'wind') { e.vx = 0; S.moveBody(e); if (e.stt > 16) { setSt(e, 'slash'); S.sfx('slice'); } }
      else if (e.st === 'slash') { S.moveBody(e); if (e.stt > 12) setSt(e, 'recover'); }
      else if (e.st === 'recover') { S.moveBody(e); if (e.stt > 32) setSt(e, 'walk'); }
    },
    boxes(e) {
      const b = [{ x0: e.x - e.w, y0: e.y - e.h, x1: e.x + e.w, y1: e.y, weak: true, harm: true }];
      if (e.st === 'slash') b.push({ x0: e.face > 0 ? e.x : e.x - 22, y0: e.y - 22, x1: e.face > 0 ? e.x + 22 : e.x, y1: e.y - 8, weak: false, harm: true, ghost: true });
      return b;
    },
    guard(e, shot) { return (e.st === 'walk' || e.st === 'wind') && !shot.pierce && Math.abs(shot.vx) > Math.abs(shot.vy) && sgn(shot.vx) !== e.face; },
    draw(e, X, Y) {
      if (e.st === 'wind') doll(e, 'swords', 'slash0', X, Y);
      else if (e.st === 'slash') doll(e, 'swords', 'slash1', X, Y);
      else if (e.st === 'leap') doll(e, 'swords', 'jump', X, Y);
      else G.blit(SPR.swords.walk[walkFrame(e)], X, Y, e.face < 0, mode(e));
      if (e.st === 'walk' || e.st === 'wind') { G.rect(X + e.face * 7 - 1, Y - 22, 3, 10, G.hex('#8a6a2a')); G.pset(X + e.face * 7, Y - 18, G.hex('#f0c848')); }
    },
  };

  // ============================================================ HAUNTED ARMOR
  D.haunt = {
    hp: 6, w: 7, h: 27, score: 500, kind: 'metal', poss: 'haunt', heavy: true,
    init(e) { e.st = 'walk'; e.turnCd = 150; },
    update(e) {
      e.stt++;
      const T = tgt(e);
      const d = T ? T.x - e.x : 999;
      if (e.st === 'walk') {
        if (--e.turnCd <= 0 && T && sgn(d) !== e.face) { setSt(e, 'turn'); return; }
        walk(e, 0.35 * S.diff);
        if (T && Math.abs(d) < 30 && sgn(d) === e.face && Math.abs(T.y - e.y) < 24) setSt(e, 'wind');
      } else if (e.st === 'turn') { S.moveBody(e); if (e.stt > 22) { e.face = -e.face; e.turnCd = 150; setSt(e, 'walk'); } }
      else if (e.st === 'wind') { S.moveBody(e); if (e.stt > 20) { setSt(e, 'slash'); S.sfx('slice'); } }
      else if (e.st === 'slash') { S.moveBody(e); if (e.stt > 14) setSt(e, 'recover'); }
      else if (e.st === 'recover') { S.moveBody(e); if (e.stt > 30) setSt(e, 'walk'); }
    },
    boxes(e) {
      const b = [{ x0: e.x - e.w, y0: e.y - e.h, x1: e.x + e.w, y1: e.y, weak: true, harm: true }];
      if (e.st === 'slash') b.push({ x0: e.face > 0 ? e.x : e.x - 24, y0: e.y - 24, x1: e.face > 0 ? e.x + 24 : e.x, y1: e.y - 6, weak: false, harm: true, ghost: true });
      return b;
    },
    guard(e, shot) { return e.st !== 'slash' && e.st !== 'recover' && !shot.pierce && Math.abs(shot.vx) > Math.abs(shot.vy) && sgn(shot.vx) !== e.face; },
    draw(e, X, Y) {
      if (e.st === 'wind') doll(e, 'haunt', 'slash0', X, Y);
      else if (e.st === 'slash') doll(e, 'haunt', 'slash1', X, Y);
      else G.blit(SPR.haunt.walk[walkFrame(e)], X, Y, e.face < 0, mode(e));
      if (e.st !== 'slash' && e.st !== 'recover') { G.rect(X + e.face * 8 - 2, Y - 24, 5, 12, G.hex('#8a6a2a')); G.rect(X + e.face * 8 - 1, Y - 20, 3, 1, G.hex('#e03030')); G.rect(X + e.face * 8, Y - 22, 1, 5, G.hex('#e03030')); }
      G.glow(X + e.face * 3, Y - 26, 6, G.hex('#ff3a20'), 0.4);
    },
  };

  // ============================================================ CYBER-IMP
  D.imp = {
    hp: 3, w: 6, h: 26, score: 300, kind: 'demon', poss: 'imp',
    init(e) { e.st = 'walk'; e.cd = 80 + rnd() * 60; },
    update(e) {
      e.stt++;
      const T = tgt(e);
      if (T && e.onGround) faceTo(e, T.x);
      const d = T ? Math.abs(T.x - e.x) : 999;
      if (e.st === 'walk') {
        e.vx = (d > 60 ? e.face * 0.8 : d < 30 ? -e.face * 0.5 : 0) * S.diff;
        const wasG = e.onGround;
        S.moveBody(e); e.dist += Math.abs(e.vx);
        if (wasG && e.onGround && (e.hitWall || (T && T.y < e.y - 40 && rnd() < 0.02))) { e.vy = -4.8; S.fx('smoke', e.x, e.y, 3); }
        if (e.onGround && edgeAhead(e) && e.vx !== 0) e.x -= e.vx;
        if (--e.cd <= 0 && T && d < 190 && S.onScreen(e.x, 0)) setSt(e, 'throw');
      } else if (e.st === 'throw') {
        e.vx = 0; S.moveBody(e);
        if (e.stt === 16 && T) { const [vx, vy] = aimShot(e.x, e.y - 20, T.x, T.y - 14, 2.4); S.eshot({ x: e.x + e.face * 8, y: e.y - 20, vx, vy, spr: SPR.fireball, r: 4, life: 200 }); S.sfx('fire'); }
        if (e.stt > 30) { setSt(e, 'walk'); e.cd = (90 + rnd() * 50) / S.diff; }
      }
    },
    draw(e, X, Y) {
      if (e.st === 'throw') doll(e, 'imp', e.stt < 16 ? 'throw0' : 'throw1', X, Y);
      else if (!e.onGround) doll(e, 'imp', 'jump', X, Y);
      else G.blit(SPR.imp.walk[walkFrame(e)], X, Y, e.face < 0, mode(e));
      if (e.st === 'throw' && e.stt < 16) G.glow(X + e.face * 9, Y - 22, 8, G.hex('#ff8a20'), 0.8);
    },
  };

  // ============================================================ RED ARREMER family
  const ARR = {
    arremer: { set: 'arremer_red', hp: 6, spd: 1.5, dodge: 0.55, fire: 1, swoop: 3.0, wake: 150 },
    gargoyle: { set: 'arremer_stone', hp: 4, spd: 1.2, dodge: 0.3, fire: 1, swoop: 2.6, wake: 70 },
    ace: { set: 'ace', hp: 44, spd: 2.1, dodge: 0.9, fire: 3, swoop: 4.0, wake: 999 },
  };
  function arremerInit(e) {
    const p = ARR[e.type]; e.p = p; e.hp = p.hp; e.st = e.type === 'ace' ? 'hover' : 'perch'; e.side = -1; e.seen = new Set();
    e.inv = e.type === 'gargoyle';
  }
  function arremerDodge(e) {
    for (const s of S.pshots) {
      if (e.seen.has(s.id)) continue;
      const dx = e.x - s.x, dy = (e.y - e.h / 2) - s.y;
      const approaching = Math.abs(s.vx) > 0.5 && sgn(s.vx) === sgn(dx);
      // the Ace predicts where the shot will be a few frames from now
      const look = e.type === 'ace' ? 110 : 70;
      if (approaching && Math.abs(dx) < look && Math.abs(dy + s.vy * 8) < 20) {
        e.seen.add(s.id);
        if (rnd() < e.p.dodge) { e.vy = -3.6 - (e.type === 'ace' ? 0.8 : 0); e.vx *= 0.3; setSt(e, 'dodge'); if (rnd() < 0.3) S.sfx('laugh'); return true; }
      }
    }
    return false;
  }
  function arremerUpdate(e) {
    e.stt++;
    const p = e.p, T = tgt(e);
    const enr = e.type === 'ace' && e.hp < e.maxhp * 0.5 ? 1.3 : 1;
    const spd = p.spd * enr * S.diff;
    if (e.st === 'perch') {
      e.noHarm = e.type === 'gargoyle'; S.moveBody(e);
      if (T) faceTo(e, T.x);
      if (T && Math.abs(T.x - e.x) < p.wake && Math.abs(T.y - e.y) < 100) { setSt(e, 'hover'); e.inv = false; e.noHarm = false; e.vy = -2; S.sfx('laugh'); S.fx('dust', e.x, e.y, 6); }
      return;
    }
    if (e.st !== 'swoop' && arremerDodge(e)) return;
    if (e.st === 'hover' || e.st === 'dodge') {
      const tx = T ? T.x + e.side * (e.type === 'ace' ? 90 : 70) : e.x, ty = T ? T.y - 70 + Math.sin(e.t * 0.05) * 12 : e.y;
      const ax = clamp((tx - e.x) * 0.02, -0.15, 0.15), ay = clamp((ty - e.y) * 0.02, -0.15, 0.15);
      e.vx = clamp(e.vx + ax, -spd, spd); e.vy = clamp(e.vy + ay, -spd * 1.6, spd);
      if (e.st === 'dodge') { e.vy += 0.12; if (e.stt > 22) setSt(e, 'hover'); }
      e.x += e.vx; e.y += e.vy;
      if (T) faceTo(e, T.x);
      if (e.st === 'hover' && e.stt > (e.type === 'ace' ? 50 : 80) + rnd() * 40 && T) {
        if (rnd() < 0.2) e.side = -e.side;
        if (p.fire && rnd() < 0.45) setSt(e, 'fire');
        else { setSt(e, 'swoop'); const [vx, vy] = aimShot(e.x, e.y - 12, T.x, T.y - 10, p.swoop * enr); e.vx = vx; e.vy = vy; S.sfx('laugh'); }
      }
    } else if (e.st === 'fire') {
      e.vx *= 0.9; e.vy *= 0.9; e.x += e.vx; e.y += e.vy;
      if (T) faceTo(e, T.x);
      if (e.stt === 18) { spray(e, e.x + e.face * 8, e.y - 16, e.type === 'ace' ? (enr > 1 ? 5 : 3) : p.fire, 0.6, 2.2, SPR.fireball); S.sfx('fire'); }
      if (e.stt > 32) setSt(e, 'hover');
    } else if (e.st === 'swoop') {
      e.x += e.vx; e.y += e.vy;
      if ((T && e.y > T.y - 6) || S.solidAt(e.x, e.y + 2) || e.stt > 90) { setSt(e, 'climb'); e.vy = -2.2; e.side = -e.side; }
    } else if (e.st === 'climb') {
      e.x += e.vx * 0.97; e.vx *= 0.97; e.y += e.vy; e.vy += 0.02;
      if (e.stt > 36) setSt(e, 'hover');
    }
    // stay in the playfield
    const cx0 = S.cam.x + 12, cx1 = S.cam.x + 308;
    if (e.type === 'ace' || S.arena) { if (e.x < cx0) { e.x = cx0; e.vx = Math.abs(e.vx); } if (e.x > cx1) { e.x = cx1; e.vx = -Math.abs(e.vx); } }
    if (e.y < 44) { e.y = 44; e.vy = Math.abs(e.vy) * 0.5; }
    if (e.y > 200) { e.y = 200; e.vy = -1.5; }
  }
  function arremerDraw(e, X, Y) {
    const set = SPR[e.p.set];
    let s;
    if (e.st === 'perch') s = set.fold;
    else if (e.st === 'swoop') s = set.up;
    else { const f = ((e.t / 5) | 0) & 3; s = [set.up, set.mid, set.down, set.mid][f]; }
    G.blit(s, X, Y, e.face < 0, mode(e));
    if (e.st === 'fire' && e.stt < 18) G.glow(X + e.face * 8, Y - (e.type === 'ace' ? 30 : 20), 9, G.hex('#ff8a20'), 0.9);
  }
  for (const k of ['arremer', 'gargoyle']) D[k] = { hp: 6, w: 8, h: 22, score: k === 'arremer' ? 1000 : 600, kind: k === 'gargoyle' ? 'stone' : 'demon', poss: 'arremer', fly: true, init: arremerInit, update: arremerUpdate, draw: arremerDraw };
  D.ace = {
    hp: 44, w: 13, h: 34, score: 10000, kind: 'demon', fly: true, boss: true, name: 'THE ARREMER ACE',
    init(e) { arremerInit(e); e.y = S.floorY - 90; },
    update(e) { if (e.st === 'dying') return bossDying(e); arremerUpdate(e); if (e.hp < e.maxhp * 0.5 && e.t % 400 === 200 && S.ents.filter(o => o.type === 'skull').length < 2) { S.spawn('skull', S.cam.x + (rnd() < 0.5 ? -10 : 330), e.y, {}); S.sfx('laugh'); } },
    draw(e, X, Y) { arremerDraw(e, X, Y); if (e.st === 'dying') bossDyingDraw(e, X, Y); },
    die(e) { startDying(e); },
  };

  // ============================================================ FLYERS
  D.skull = {
    hp: 1, w: 5, h: 10, score: 100, kind: 'bone', fly: true,
    init(e) { const T = tgt(e); e.face = T ? sgn(T.x - e.x) : -1; e.by = e.y; e.st = 'fly'; },
    update(e) {
      const T = tgt(e);
      e.x += e.face * 1.1 * S.diff;
      if (T) e.by += clamp((T.y - 14 - e.by) * 0.01, -0.4, 0.4);
      e.y = e.by + Math.sin(e.t * 0.08) * 14;
      if (e.t % 4 === 0) S.fx('ghost', e.x - e.face * 4, e.y - 5, 1);
      if (e.t > 60 && !S.onScreen(e.x, 60)) e.dead = true;
    },
    draw(e, X, Y) { G.blit(SPR.skull[(e.t >> 3) & 1], X, Y - 5, e.face < 0, mode(e)); },
  };
  D.bat = {
    hp: 1, w: 5, h: 8, score: 100, kind: 'demon', fly: true,
    init(e) { const T = tgt(e); e.face = T ? sgn(T.x - e.x) : -1; e.st = 'fly'; },
    update(e) {
      const T = tgt(e);
      e.vx = e.face * 1.4 * S.diff;
      if (T) e.vy = clamp((T.y - 16 - e.y) * 0.03, -1.2, 1.2) + Math.sin(e.t * 0.2) * 0.8;
      e.x += e.vx; e.y += e.vy;
      if (e.t > 60 && !S.onScreen(e.x, 60)) e.dead = true;
    },
    draw(e, X, Y) { G.blit(SPR.bat[(e.t >> 2) & 1], X, Y - 4, e.face < 0, mode(e)); },
  };
  D.eelspot = {
    hp: 1, inv: true, harmless: true, untargetable: true,
    init(e) { e.cd = 60 + rnd() * 120; e.untargetable = true; },
    update(e) {
      const T = tgt(e);
      if (--e.cd <= 0 && T && Math.abs(T.x - e.x) < 130 && S.onScreen(e.x, 0)) {
        e.cd = (150 + rnd() * 90) / S.diff;
        const eel = S.spawn('eel', e.x, e.y + 4, { face: sgn(T.x - e.x) });
        if (eel) { eel.vx = clamp((T.x - e.x) / 60, -1.6, 1.6); eel.vy = -5.6; eel.home = e.y + 6; }
        S.fx('splash', e.x, e.y, 8); S.sfx('splash');
      }
    },
    draw() {},
  };
  D.eel = {
    hp: 2, w: 7, h: 8, score: 200, kind: 'fish', fly: true,
    update(e) {
      e.x += e.vx; e.y += e.vy; e.vy += 0.15;
      e.face = sgn(e.vx || 1);
      if (e.vy > 0 && e.y > e.home) { e.dead = true; S.fx('splash', e.x, e.home - 4, 6); }
    },
    draw(e, X, Y) { G.blitRot(SPR.eel[(e.t >> 3) & 1], X, Y - 4, Math.atan2(e.vy, Math.abs(e.vx) + 0.001) * (e.face < 0 ? -1 : 1), e.face < 0, mode(e) === 1 ? 1 : 0); },
  };

  // ============================================================ LEMMINGS
  D.lemming = {
    hp: 1, w: 3, h: 10, score: 50, kind: 'lemming', harmless: true, poss: 'lemming',
    init(e) { e.face = e.o.face || 1; e.st = 'walk'; e.fallY = e.o.safe ? 1e9 : e.y; e.safe = !!e.o.safe; },
    update(e) {
      const was = e.onGround;
      e.vx = e.onGround ? e.face * 0.4 : 0;
      S.moveBody(e); e.dist += Math.abs(e.vx);
      if (e.onGround) {
        if (!was && e.y - e.fallY > 70 && !e.safe) { S.fx('blood', e.x, e.y - 3, 8); S.sfx('hit'); e.dead = true; return; }
        e.fallY = e.y; e.safe = false;
        if (blockedAhead(e)) e.face = -e.face;
      }
    },
    draw(e, X, Y) { if (!e.onGround && e.safe) { G.blit(SPR.lemming.walk[0], X, Y, e.face < 0, mode(e)); G.ellipse(X, Y - 14, 6, 2, G.hex('#f0f0f0')); G.line(X - 5, Y - 13, X, Y - 8, G.hex('#a0a0a0')); G.line(X + 5, Y - 13, X, Y - 8, G.hex('#a0a0a0')); } else if (!e.onGround) G.blit(SPR.lemming.ohno, X, Y, e.face < 0, mode(e)); else G.blit(SPR.lemming.walk[((e.dist / 3) | 0) & 1], X, Y, e.face < 0, mode(e)); },
  };
  D.blocker = {
    hp: 1, w: 4, h: 10, score: 300, kind: 'lemming', harmless: true, poss: 'lemming',
    init(e) { e.st = 'block'; },
    update(e) {
      e.stt++; S.moveBody(e);
      const P = S.P;
      if (e.st === 'block' && !P.dead && Math.abs(P.x - e.x) < 64 && Math.abs(P.y - e.y) < 50) { setSt(e, 'count'); S.sfx('ohno'); }
      if (e.st === 'count' && e.stt >= 150) { e.dead = true; S.explode(e.x, e.y - 6, 40, 'enemy'); }
      if (e.st === 'fuse' && e.stt >= 8) { e.dead = true; S.explode(e.x, e.y - 6, 40, 'enemy'); }
    },
    hurt(e) { if (e.st !== 'fuse') { setSt(e, 'fuse'); S.addScore(300, e.x, e.y - 12); } return false; },
    draw(e, X, Y) {
      const oh = e.st === 'count' && e.stt > 120;
      G.blit(oh ? SPR.lemming.ohno : SPR.lemming.block, X, Y, false, e.st === 'fuse' && (e.stt & 2) ? 1 : 0);
      if (e.st === 'count') { const n = 5 - Math.floor(e.stt / 30); G.text(oh ? 'OH NO!' : String(Math.max(1, n)), X - (oh ? 17 : 2), Y - 20, G.hex('#ffffff'), G.hex('#000000')); }
    },
  };
  D.hatch = {
    hp: 1, inv: true, harmless: true, untargetable: true,
    init(e) { e.cd = 30; e.kids = []; e.untargetable = true; },
    update(e) {
      e.kids = e.kids.filter(k => !k.dead);
      if (S.onScreen(e.x, 40) && --e.cd <= 0 && e.kids.length < 4) {
        e.cd = 150; const k = S.spawn('lemming', e.x, e.y + 12, { face: 1, safe: true }); if (k) k.maxFall = 1.2; if (k) e.kids.push(k); e.open = 20;
      }
      if (e.open > 0) e.open--;
    },
    draw(e, X, Y) { G.blit(SPR.hatch, X, Y); if (e.open > 0) G.rect(X - 10, Y + 5, 20, 3, G.hex('#000000')); },
  };

  // ============================================================ PROPS
  D.barrel = {
    hp: 1, w: 5, h: 14, score: 100, kind: 'metal', harmless: true,
    update(e) { S.moveBody(e); },
    die(e) { e.dead = true; S.explode(e.x, e.y - 8, 46, 'barrel'); S.addScore(100, e.x, e.y - 16); },
    draw(e, X, Y) { G.blit(SPR.barrel, X, Y, false, mode(e)); },
  };
  D.cannon = {
    hp: 4, w: 9, h: 11, score: 300, kind: 'metal',
    init(e) { e.cd = 100; },
    update(e) {
      S.moveBody(e);
      const T = tgt(e); if (T) faceTo(e, T.x);
      if (--e.cd <= 0 && T && S.onScreen(e.x, -10) && Math.abs(T.x - e.x) > 30) {
        e.cd = 170 / S.diff;
        S.eshot({ x: e.x + e.face * 11, y: e.y - 7, vx: e.face * clamp(Math.abs(T.x - e.x) / 55, 1.2, 2.8), vy: -2.6, grav: 0.1, spr: SPR.cannonball, r: 4, life: 300, kind: 'cannonball' });
        S.fx('smoke', e.x + e.face * 12, e.y - 8, 6); S.sfx('cannon'); e.recoil = 6;
      }
      if (e.recoil > 0) e.recoil--;
    },
    draw(e, X, Y) { G.blit(SPR.cannon, X - e.face * (e.recoil > 0 ? 2 : 0), Y, e.face < 0, mode(e)); },
  };

  // ============================================================ TRAPS
  D.slicer = {
    hp: 1, inv: true, untargetable: true, w: 5, h: 42,
    init(e) { e.ph = Math.floor(e.x / 16) * 17 % 120; e.untargetable = true; },
    update(e) {
      const c = (S.t + e.ph) % 120;
      e.closed = c >= 88 && c < 108; e.k = c < 80 ? 0 : c < 88 ? (c - 80) / 8 : c < 108 ? 1 : 1 - (c - 108) / 12;
      if (c === 88 && S.onScreen(e.x, 0)) S.sfx('slice');
    },
    boxes(e) { return e.closed ? [{ x0: e.x - 5, y0: e.y - 40, x1: e.x + 5, y1: e.y - 2, weak: false, harm: true, ghost: true }] : []; },
    draw(e, X, Y) {
      const k = e.k || 0, gap = 22 * (1 - k), mid = Y - 21;
      const blade = G.hex('#c8ccd8'), dk = G.hex('#4a4a58'), red = G.hex('#a01010');
      G.rect(X - 2, Y - 46, 4, 4, dk); G.rect(X - 2, Y - 2, 4, 2, dk);
      const top = mid - gap, bot = mid + gap;
      for (let y = Y - 44; y < top; y++) { G.pset(X - 1, y, dk); G.pset(X, y, dk); }
      G.poly([X - 6, top - 3, X + 6, top - 3, X + 6, top, X - 6, top + 2], blade);
      for (let i = -5; i < 6; i += 2) G.pset(X + i, top + 1, blade);
      G.poly([X - 6, bot + 3, X + 6, bot + 3, X + 6, bot, X - 6, bot - 2], blade);
      for (let y = bot + 3; y < Y - 2; y++) { G.pset(X - 1, y, dk); G.pset(X, y, dk); }
      if (k > 0.9) { G.pset(X - 3, mid, red); G.pset(X + 2, mid + 1, red); }
    },
  };
  D.piston = {
    hp: 1, inv: true, untargetable: true, w: 16, h: 14,
    init(e) { e.y0 = e.y; e.hy = e.y + 20; e.st = 'up'; e.stt = e.o.ph || 0; e.floor = S.groundBelow(e.x, e.y + 20); e.untargetable = true; e.wait = e.o.wait || 80; },
    update(e) {
      e.stt++;
      const top = e.y0 + 20;
      if (e.st === 'up') { e.hy = top; if (e.stt > e.wait) setSt(e, 'slam'); }
      else if (e.st === 'slam') {
        e.hy += 7;
        const A = S.anvil;
        const stop = A && !A.air && Math.abs(A.x - e.x) < 22 && A.y > e.hy - 4 ? A.y - 14 : e.floor;
        if (e.hy >= stop) {
          e.hy = stop;
          if (stop !== e.floor) {
            setSt(e, 'jam'); S.sfx('clang'); S.fx('spark', e.x, e.hy, 14); S.shake(3);
            if (e.o.engine) e.o.engine.def.jam(e.o.engine, e);
            // the recoil flings the anvil clear, so each jam needs a fresh placement
            A.air = true; A.onGround = false; A.vy = -3.6; A.vx = (rnd() < 0.5 ? -1 : 1) * (0.8 + rnd() * 0.8);
          }
          else { setSt(e, 'down'); if (S.onScreen(e.x, 20)) { S.sfx('piston'); S.shake(2); } S.fx('dust', e.x - 12, e.hy, 3); S.fx('dust', e.x + 12, e.hy, 3); }
        }
      } else if (e.st === 'down') { if (e.stt > 26) setSt(e, 'rise'); }
      else if (e.st === 'rise') { e.hy -= 1.3; if (e.hy <= top) setSt(e, 'up'); }
      else if (e.st === 'jam') { if (e.stt > 20) { e.hy = Math.max(top, e.hy - 2); if (e.t % 6 === 0) S.fx('smoke', e.x, e.hy - 10, 1); if (e.hy <= top && e.stt > 90) setSt(e, 'up'); } }
    },
    boxes(e) { return (e.st === 'slam' || (e.st === 'down' && e.stt < 4)) ? [{ x0: e.x - 15, y0: e.hy - 14, x1: e.x + 15, y1: e.hy, weak: false, harm: true, crush: true }] : []; },
    draw(e, X, Y) {
      const cy = e.hy - S.cam.y;
      const shaft = G.hex('#8a8698'), dk = G.hex('#4a4656');
      G.rect(X - 5, Y, 10, cy - 12 - Y, shaft); G.rect(X - 5, Y, 2, cy - 12 - Y, G.hex('#c8c4d8')); G.rect(X + 3, Y, 2, cy - 12 - Y, dk);
      G.rect(X - 10, Y - 2, 20, 6, dk);
      G.blit(SPR.pistonHead, X, cy);
      if (e.st === 'jam') G.text('JAMMED', X - 17, cy - 26, (e.t & 8) ? G.hex('#ffe040') : G.hex('#ff4040'), G.hex('#000000'));
    },
  };

  // ============================================================ BOSS HELPERS
  function startDying(e) { e.st = 'dying'; e.stt = 0; e.inv = true; e.noHarm = true; S.sfx('bossdie'); S.clearEShots(); }
  function bossDying(e) {
    e.stt++;
    if (e.stt % 6 === 0) { const bx = e.x + (rnd() - 0.5) * 70, by = e.y - rnd() * 80; S.fx('boom', bx, by, 1); S.shake(3); }
    if (e.stt % 20 === 0) S.sfx('explode');
    if (e.stt >= 130) { e.dead = true; S.bossDefeated(e); }
    return true;
  }
  function bossDyingDraw(e) { if ((e.stt & 7) < 3) S.flash(0.25); }
  const box = (x, y, w, h, weak, harm = true) => ({ x0: x - w, y0: y - h, x1: x + w, y1: y, weak, harm });

  // ============================================================ BOSS 1 · GHOST CAPTAIN
  D.ghostcap = {
    hp: 50, w: 20, h: 40, score: 10000, boss: true, kind: 'ghost', name: 'GHOST PIRATE LECHUCK', fly: true,
    init(e) {
      e.cx = S.arena.x + 230; e.by = S.floorY - 78; e.x = e.cx; e.y = e.by;
      e.hands = [-1, 1].map(s => ({ s, x: e.x + s * 44, y: e.y + 10, st: 'rest', t: 0, tx: 0 }));
      e.nextSlam = 90; e.mouth = 0; e.cd = 160; e.turn = 0; e.st = 'fight';
    },
    update(e) {
      if (e.st === 'dying') return bossDying(e);
      const P = S.P, enr = e.hp < e.maxhp * 0.5;
      e.x = e.cx + Math.sin(e.t * 0.012) * 60; e.y = e.by + Math.sin(e.t * 0.035) * 8;
      if (--e.nextSlam <= 0) { const h = e.hands[e.turn]; e.turn ^= 1; if (h.st === 'rest') { h.st = 'raise'; h.t = 0; } e.nextSlam = enr ? 70 : 110; }
      for (const h of e.hands) {
        h.t++;
        const rx = e.x + h.s * 44, ry = e.y + 10 + Math.sin(e.t * 0.05 + h.s) * 4;
        if (h.st === 'rest') { h.x += (rx - h.x) * 0.1; h.y += (ry - h.y) * 0.1; }
        else if (h.st === 'raise') { h.tx = P.x; h.x += (h.tx - h.x) * 0.08; h.y += (S.floorY - 110 - h.y) * 0.1; if (h.t > (enr ? 24 : 34)) { h.st = 'drop'; h.vy = 0; } }
        else if (h.st === 'drop') { h.vy += 0.7; h.y += h.vy; if (h.y >= S.floorY - 8) { h.y = S.floorY - 8; h.st = 'stay'; h.t = 0; S.shake(5); S.sfx('piston'); S.fx('dust', h.x - 10, S.floorY, 4); S.fx('dust', h.x + 10, S.floorY, 4); if (enr) for (const d of [-1, 1]) S.eshot({ x: h.x + d * 10, y: S.floorY - 5, vx: d * 2, vy: 0, spr: SPR.ghostfire, r: 4, life: 120, ground: 'pass' }); } }
        else if (h.st === 'stay') { if (h.t > 28) h.st = 'rest'; }
      }
      if (--e.cd <= 0) { e.mouth = 50; e.cd = enr ? 150 : 200; }
      if (e.mouth > 0) { e.mouth--; if (e.mouth === 25) { spray(e, e.x, e.y - 6, enr ? 5 : 3, 0.9, 1.8, SPR.ghostfire); S.sfx('laugh'); } }
      if (e.t % 5 === 0) S.fx('ghost', e.x + (rnd() - 0.5) * 50, e.y + 20, 1);
    },
    boxes(e) {
      if (e.st === 'dying') return [];
      const b = [box(e.x, e.y - 6, 16, 32, true)];
      for (const h of e.hands) b.push(box(h.x, h.y + 8, 11, 18, false));
      return b;
    },
    draw(e, X, Y) {
      const m = mode(e), cy = S.cam.y;
      G.blit(SPR.ghostCap[e.mouth > 0 ? 1 : 0], X, Y, false, m ? 1 : 2, 0.85);
      G.blit(SPR.ghostCap[e.mouth > 0 ? 1 : 0], X, Y, false, m ? 1 : 4, 0.25);
      for (const h of e.hands) { G.blit(SPR.ghostHand[h.st === 'drop' || h.st === 'stay' ? 1 : 0], h.x - S.cam.x, h.y - cy, h.s < 0, 2, 0.85); if (h.st === 'raise') G.rectA(h.x - S.cam.x - 12, S.floorY - cy - 2, 24, 2, G.hex('#40ff90'), 0.5); }
      if (e.st === 'dying') bossDyingDraw(e);
    },
    die(e) { startDying(e); },
  };

  // ============================================================ BOSS 2 · MOAT DRAGON
  D.dragon = {
    hp: 55, w: 14, h: 20, score: 10000, boss: true, kind: 'fish', name: 'THE MOAT DRAGON', fly: true,
    init(e) { e.bx = S.arena.x + 160; e.bxBase = e.bx; e.by = S.floorY + 20; e.x = e.bx; e.y = e.by - 60; e.cd = 150; e.mouth = 0; e.dive = 0; e.st = 'rise'; e.segs = []; S.sfx('splash'); },
    update(e) {
      if (e.st === 'dying') { if (e.stt % 3 === 0) e.y += 1; return bossDying(e); }
      e.stt++;
      const P = S.P, enr = e.hp < e.maxhp * 0.5;
      let hx = e.bx + Math.sin(e.t * 0.013) * 95, hy = S.floorY - 78 + Math.sin(e.t * 0.021) * 36;
      if (e.st === 'rise') { hy = e.by - Math.min(1, e.stt / 60) * (e.by - hy); if (e.stt > 60) setSt(e, 'fight'); }
      if (e.st === 'fight' && e.t % 700 === 650) { setSt(e, 'dive'); S.sfx('splash'); }
      if (e.st === 'dive') { hy = e.y + (e.by + 30 - e.y) * 0.08; hx = e.x; if (e.stt > 50) { e.bx = e.bxBase + (rnd() < 0.5 ? -40 : 40); S.fx('splash', e.bx, S.floorY + 4, 14); S.sfx('splash'); setSt(e, 'rise'); } }
      e.x += (hx - e.x) * 0.08; e.y += (hy - e.y) * 0.08;
      e.face = P.x < e.x ? -1 : 1;
      if (e.st === 'fight' && --e.cd <= 0) { e.mouth = 44; e.cd = enr ? 110 : 160; }
      if (e.mouth > 0) { e.mouth--; if (e.mouth === 22 || (enr && e.mouth === 8)) { spray(e, e.x + e.face * 16, e.y - 6, 3, 0.5, 2.1, SPR.fireball); S.sfx('fire'); } }
      // neck: quadratic bezier from the moat to the head
      const n = 7, cx = e.bx + (e.x - e.bx) * 0.15, cy = e.y + 70;
      e.segs.length = 0;
      for (let i = 1; i <= n; i++) { const t = i / (n + 1), u = 1 - t; e.segs.push([u * u * e.bx + 2 * u * t * cx + t * t * e.x, u * u * e.by + 2 * u * t * cy + t * t * e.y]); }
    },
    boxes(e) {
      if (e.st === 'dying' || e.st === 'dive') return [];
      const b = [box(e.x + e.face * 4, e.y + 6, 13, 20, true)];
      for (const [x, y] of e.segs) if (y < S.floorY + 4) b.push(box(x, y + 7, 7, 14, false));
      return b;
    },
    draw(e, X, Y) {
      const cx = S.cam.x, cy = S.cam.y;
      for (let i = 0; i < e.segs.length; i++) { const [x, y] = e.segs[i]; G.blit(SPR.dragonSeg, x - cx, y - cy, false, mode(e) ? 1 : 0, 0, S.floorY - cy + 6); }
      G.blit(SPR.dragonHead[e.mouth > 0 ? 1 : 0], X, Y, e.face < 0, mode(e), 0, S.floorY - cy + 6);
      if (e.mouth > 22) G.glow(X + e.face * 20, Y - 2, 10, G.hex('#ff8a20'), 0.8);
      if (e.st === 'dying') bossDyingDraw(e);
    },
    die(e) { startDying(e); },
  };

  // ============================================================ BOSS 3 · JAFFAR
  D.jaffar = {
    hp: 50, w: 9, h: 44, score: 10000, boss: true, kind: 'demon', name: 'GRAND VIZIER JAFFAR',
    init(e) { e.x = S.arena.x + 250; e.y = S.floorY; e.st = 'idle'; e.cycle = 0; e.alpha = 1; },
    update(e) {
      if (e.st === 'dying') return bossDying(e);
      e.stt++;
      const P = S.P, enr = e.hp < e.maxhp * 0.5;
      if (e.st !== 'out') e.face = P.x < e.x ? -1 : 1;
      if (e.st === 'idle') { e.alpha = 1; if (e.stt > (enr ? 40 : 60)) setSt(e, e.cycle % 3 === 2 ? 'summon' : 'cast'); }
      else if (e.st === 'cast') {
        if (e.stt === 20) {
          if (e.cycle & 1) { spray(e, e.x + e.face * 12, e.y - 34, enr ? 5 : 3, 0.7, 2.2, SPR.ghostfire); }
          else S.eshot({ x: e.x + e.face * 12, y: S.floorY - 6, vx: e.face * 2.3, vy: 0, spr: SPR.bluefire, r: 6, life: 170, ground: 'pass', kind: 'wave', ay: 11 });
          S.sfx('fire');
        }
        if (e.stt > 44) { e.cycle++; setSt(e, 'fade'); S.sfx('teleport'); }
      } else if (e.st === 'summon') {
        if (e.stt === 24) {
          if (S.ents.filter(o => o.type === 'swords' && !o.dead).length < 2) { const sx = clamp(P.x + (rnd() < 0.5 ? -90 : 90), S.arena.x + 20, S.arena.x + 300); const s = S.spawn('swords', sx, S.floorY, {}); if (s) S.fx('smoke', sx, S.floorY - 12, 12); }
          S.sfx('laugh');
        }
        if (e.stt > 44) { e.cycle++; setSt(e, 'fade'); S.sfx('teleport'); }
      } else if (e.st === 'fade') { e.alpha = 1 - e.stt / 20; e.inv = true; if (e.stt >= 20) { setSt(e, 'out'); } }
      else if (e.st === 'out') {
        e.alpha = 0;
        if (e.stt > 25) { let nx; for (let i = 0; i < 8; i++) { nx = S.arena.x + 30 + rnd() * 260; if (Math.abs(nx - P.x) > 90) break; } e.x = nx; setSt(e, 'appear'); }
      } else if (e.st === 'appear') { e.alpha = e.stt / 20; if (e.stt >= 20) { e.inv = false; setSt(e, 'idle'); } }
      e.noHarm = e.alpha < 0.6;
    },
    draw(e, X, Y) {
      const s = SPR.jaffar[e.flash > 0 ? 2 : e.st === 'cast' || e.st === 'summon' ? 1 : 0];
      if (e.alpha >= 1) G.blit(s, X, Y, e.face < 0, mode(e)); else if (e.alpha > 0) G.blit(s, X, Y, e.face < 0, 2, e.alpha);
      if (e.st === 'cast' && e.stt < 20) G.glow(X + e.face * 13, Y - 38, 10, G.hex('#c040ff'), 0.9);
      if (e.st === 'fade' || e.st === 'appear') for (let i = 0; i < 3; i++) S.fx('magic', e.x + (rnd() - 0.5) * 20, e.y - rnd() * 44, 1);
      if (e.st === 'dying') bossDyingDraw(e);
    },
    die(e) { startDying(e); for (const o of S.ents) if (o.type === 'swords') { o.dead = true; S.fx('bones', o.x, o.y - 12, 8); } },
  };

  // ============================================================ BOSS 4 · 10-TON CRUSHER ENGINE
  D.engine = {
    hp: 60, w: 44, h: 100, score: 10000, boss: true, kind: 'metal', name: 'THE 10-TON CRUSHER ENGINE',
    init(e) {
      e.x = S.arena.x + 268; e.y = S.floorY; e.st = 'closed'; e.open = 0;
      e.pistons = [48, 112, 176].map((dx, i) => S.spawn('piston', S.arena.x + dx, 32, { ph: i * 35, wait: 50, engine: e }));
      e.cd = 200;
    },
    update(e) {
      if (e.st === 'dying') return bossDying(e);
      e.stt++;
      const enr = e.hp < e.maxhp * 0.5;
      if (e.st === 'closed') { if (e.stt > (enr ? 140 : 190)) { setSt(e, 'open'); S.sfx('gate'); } }
      else if (e.st === 'open') {
        if (e.stt === 30 || e.stt === 70 || (enr && e.stt === 50)) { for (let i = 0; i < 2; i++) S.eshot({ x: e.x - 20, y: e.y - 64, vx: -1.2 - rnd() * 2.2, vy: -3 - rnd() * 1.5, grav: 0.12, spr: SPR.fireball, r: 4, life: 300 }); S.sfx('fire'); }
        if (e.stt === 90 && S.ents.filter(o => o.type === 'blocker' || o.type === 'lemming').length < 2) S.spawn(rnd() < 0.5 ? 'blocker' : 'lemming', e.x - 56, S.floorY, { face: -1 });
        if (e.stt > 120 + e.open) { e.open = 0; setSt(e, 'closed'); S.sfx('gate'); }
      }
      if (e.t % 8 === 0) S.fx('smoke', e.x - 30 + rnd() * 60, e.y - 108, 1);
    },
    jam(e, p) { if (e.st === 'dying') return; S.fx('spark', e.x - 20, e.y - 60, 20); e.hp -= 12; e.flash = 16; S.addScore(2000, p.x, p.hy - 20); S.sfx('bosshit'); if (e.hp <= 0) this.die(e); else { setSt(e, 'open'); e.open = 60; } S.banner('GEARS JAMMED!'); },
    boxes(e) {
      if (e.st === 'dying') return [];
      // furnace door (weak only while open) + armoured boiler dome above it
      return [{ x0: e.x - 42, y0: e.y - 68, x1: e.x + 24, y1: e.y - 2, weak: e.st === 'open', harm: true },
        { x0: e.x - 48, y0: e.y - 110, x1: e.x + 50, y1: e.y - 68, weak: false, harm: true }];
    },
    draw(e, X, Y) {
      G.blit(SPR.engine[e.st === 'open' ? 1 : 0], X, Y, false, mode(e));
      if (e.st === 'open') G.glow(X, Y - 46, 30, G.hex('#ff6a10'), 0.5);
      const g = (e.t * 0.05) % (PI * 2); for (let k = 0; k < 6; k++) { const a = g + k / 6 * PI * 2; G.disc(X + 38 + Math.cos(a) * 8, Y - 40 + Math.sin(a) * 8, 2, G.hex('#8a7a60')); }
      if (e.st === 'dying') bossDyingDraw(e);
    },
    die(e) { startDying(e); for (const p of e.pistons) if (p) { p.dead = true; S.fx('spark', p.x, p.hy, 10); } },
  };

  // ============================================================ BOSS 6 · ASTAROTH-LECHUCK-9000
  D.final = {
    hp: 45, w: 50, h: 100, score: 50000, boss: true, kind: 'demon', name: 'ASTAROTH', fly: true,
    init(e) { e.phase = 1; e.x = S.arena.x + 250; e.y = S.floorY; e.st = 'idle'; e.mouth = 0; e.beam = 0; e.cd = 120; e.act = 0; },
    update(e) {
      if (e.st === 'dying') return bossDying(e);
      if (e.st === 'morph') { e.stt++; if (e.stt % 6 === 0) { S.fx('boom', e.x + (rnd() - 0.5) * 80, e.y - rnd() * 90, 1); S.shake(3); S.sfx('explode'); } if (e.stt >= 80) this.nextPhase(e); return; }
      e.stt++;
      const P = S.P;
      if (e.phase === 1) {
        // ASTAROTH: belly-mouth beam, fist-slam shockwaves, fire spit
        e.x = S.arena.x + 250 + Math.sin(e.t * 0.01) * 8;
        if (e.st === 'idle' && e.stt > 60) { const a = ['beam', 'slam', 'spit'][e.act++ % 3]; setSt(e, a); }
        if (e.st === 'beam') {
          e.mouth = 1;
          if (e.stt === 45) S.sfx('beam');
          e.beam = e.stt < 45 ? 1 : e.stt < 95 ? 2 : 0;
          if (e.beam === 2 && !P.dead) { const by0 = S.floorY - 26, by1 = S.floorY - 18; if (P.x < e.x - 20 && P.y - P.h < by1 && P.y > by0) S.hurtPlayer(e); }
          if (e.stt > 100) { e.mouth = 0; e.beam = 0; setSt(e, 'idle'); }
        } else if (e.st === 'slam') {
          if (e.stt === 30 || e.stt === 70) { S.shake(6); S.sfx('piston'); S.eshot({ x: e.x - 60, y: S.floorY - 1, vx: -2.4, vy: 0, spr: SPR.bluefire, r: 6, life: 200, ground: 'pass', ay: 11 }); S.fx('dust', e.x - 60, S.floorY, 8); }
          if (e.stt > 90) setSt(e, 'idle');
        } else if (e.st === 'spit') {
          e.mouth = 1;
          if (e.stt % 16 === 0 && e.stt <= 48) { S.eshot({ x: e.x, y: e.y - 36, vx: -1 - rnd() * 2.5, vy: -3.2, grav: 0.12, spr: SPR.fireball, r: 4, life: 300 }); S.sfx('fire'); }
          if (e.stt > 60) { e.mouth = 0; setSt(e, 'idle'); }
        }
      } else if (e.phase === 2) {
        // LECHUCK: flaming head, figure-8 flight, homing voodoo skulls, dive
        const cx = S.arena.x + 160;
        if (e.st === 'dive') { e.x += e.vx; e.y += e.vy; if (e.y > S.floorY - 20 || e.stt > 60) setSt(e, 'idle'); }
        else { const tx = cx + Math.sin(e.t * 0.02) * 115, ty = S.floorY - 100 + Math.sin(e.t * 0.04) * 38; e.x += (tx - e.x) * 0.06; e.y += (ty - e.y) * 0.06; }
        if (e.st === 'idle' && e.t % 90 === 0) { S.eshot({ x: e.x, y: e.y - 20, vx: 0, vy: -1.5, spr: SPR.skull, r: 5, life: 220, homing: 0.045, spd: 1.6 * S.diff, ay: 5 }); S.sfx('laugh'); }
        if (e.st === 'idle' && e.stt > 280) { const [vx, vy] = aimShot(e.x, e.y, P.x, P.y - 12, 3.4); e.vx = vx; e.vy = vy; setSt(e, 'dive'); S.sfx('laugh'); }
        if (e.t % 3 === 0) S.fx('fire', e.x + (rnd() - 0.5) * 30, e.y - 40, 1);
        e.face = P.x < e.x ? -1 : 1;
      } else {
        // 9000: core eye, sweeping laser, floppy boomerangs
        const tx = S.arena.x + 160 + Math.sin(e.t * 0.015) * 60; e.x += (tx - e.x) * 0.05; e.y += (S.floorY - 96 - e.y) * 0.05;
        if (e.st === 'idle' && e.stt > 70) setSt(e, e.act++ % 2 ? 'laser' : 'floppy');
        if (e.st === 'laser') {
          e.eye = 1;
          const dir = e.act % 4 < 2 ? 1 : -1;
          e.la = PI / 2 + dir * (1.2 - Math.min(1, Math.max(0, (e.stt - 40) / 90)) * 2.4);
          e.beam = e.stt < 40 ? 1 : e.stt < 130 ? 2 : 0;
          if (e.stt === 40) S.sfx('beam');
          if (e.beam === 2 && !P.dead) {
            const ox = e.x, oy = e.y, dx = Math.cos(e.la), dy = Math.sin(e.la);
            const px = P.x - ox, py = P.y - P.h / 2 - oy, along = px * dx + py * dy, perp = Math.abs(px * dy - py * dx);
            if (along > 0 && perp < 7) S.hurtPlayer(e);
            if (e.t % 3 === 0) { const L = (S.floorY - oy) / Math.max(0.2, dy); S.fx('spark', ox + dx * L, S.floorY - 2, 1); }
          }
          if (e.stt > 135) { e.eye = 0; e.beam = 0; setSt(e, 'idle'); }
        } else if (e.st === 'floppy') {
          e.eye = 1;
          if (e.stt % 20 === 10 && e.stt < 70) { const a = PI * (0.55 + rnd() * 0.5); S.eshot({ x: e.x, y: e.y, vx: Math.cos(a) * 3.2 * (P.x < e.x ? 1 : -1) * -1, vy: Math.sin(a) * 1.5 + 1, spr: SPR.floppy, r: 5, life: 200, boomer: { x: e.x, y: e.y, t: 0 }, rot: 0.25, ground: 'pass', ay: 6 }); S.sfx('throw'); }
          if (e.stt > 90) { e.eye = 0; setSt(e, 'idle'); }
        }
      }
    },
    nextPhase(e) {
      e.phase++; e.st = 'idle'; e.stt = 0; e.inv = false; e.noHarm = false; e.beam = 0; e.mouth = 0;
      if (e.phase === 2) { e.name = 'LECHUCK'; e.hp = e.maxhp = 40 * S.diff; e.x = S.arena.x + 240; e.y = S.floorY - 60; S.banner('YOU FIGHT LIKE A DAIRY FARMER!'); }
      else { e.name = 'THE 9000 CORE'; e.hp = e.maxhp = 50 * S.diff; e.y = S.floorY - 180; e.x = S.arena.x + 160; e.eye = 0; S.banner("I'M SORRY ARTHUR, I CAN'T LET YOU DO THAT"); }
      S.sfx('laugh');
    },
    boxes(e) {
      if (e.st === 'dying' || e.st === 'morph') return [];
      if (e.phase === 1) return [box(e.x, e.y - 22, 20, 30, true), { x0: e.x - 56, y0: e.y - 112, x1: e.x + 56, y1: e.y - 52, weak: false, harm: true }, { x0: e.x - 60, y0: e.y - 30, x1: e.x - 36, y1: e.y, weak: false, harm: true }];
      if (e.phase === 2) return [box(e.x, e.y + 6, 17, 30, true)];
      return [box(e.x, e.y + 12, 13, 24, !!e.eye), { x0: e.x - 30, y0: e.y - 33, x1: e.x + 30, y1: e.y - 12, weak: false, harm: true },
        { x0: e.x - 30, y0: e.y - 12, x1: e.x - 13, y1: e.y + 26, weak: false, harm: true }, { x0: e.x + 13, y0: e.y - 12, x1: e.x + 30, y1: e.y + 26, weak: false, harm: true }];
    },
    draw(e, X, Y) {
      const m = mode(e), cy = S.cam.y;
      if (e.phase === 1) {
        G.blit(SPR.astaroth[e.mouth ? 1 : 0], X, Y, false, m);
        if (e.beam === 1) G.glow(X, Y - 33, 6 + e.stt * 0.35, G.hex('#ff6010'), 0.9);
        if (e.beam === 2) { const by = S.floorY - 22 - cy; for (let x = 0; x < X - 10; x++) { const w = 3 + Math.sin(x * 0.3 + e.t) * 1; G.rect(x, by - w, 1, w * 2, G.hex('#ff8a20')); G.pset(x, by, G.hex('#fff8c0')); } G.thick(X - 10, by, X, Y - 33, 3, G.hex('#ff8a20')); }
      } else if (e.phase === 2) {
        G.blit(SPR.lechuck[(e.t >> 3) & 1], X, Y, e.face < 0, m);
        G.glow(X, Y - 20, 30, G.hex('#40f0a0'), 0.25);
      } else {
        G.blit(SPR.core9000[e.eye ? 1 : 0], X, Y, false, m);
        G.glow(X, Y - 10, e.eye ? 22 : 12, G.hex('#ff2010'), e.eye ? 0.6 : 0.3);
        if (e.beam) {
          const dx = Math.cos(e.la), dy = Math.sin(e.la), L = (S.floorY - e.y) / Math.max(0.2, dy);
          const x1 = X + dx * L, y1 = Y - 10 + dy * L;
          if (e.beam === 1) G.line(X, Y - 10, x1, y1, (e.t & 4) ? G.hex('#ff4040') : G.hex('#802020'));
          else { G.thick(X, Y - 10, x1, y1, 2.5, G.hex('#ff3020')); G.line(X, Y - 10, x1, y1, G.hex('#fff0e0')); }
        }
      }
      if (e.st === 'morph' || e.st === 'dying') bossDyingDraw(e);
    },
    die(e) {
      if (e.phase < 3) { e.st = 'morph'; e.stt = 0; e.inv = true; e.noHarm = true; e.beam = 0; S.clearEShots(); S.sfx('bossdie'); S.addScore(10000, e.x, e.y - 60); return; }
      startDying(e);
    },
  };

  // possession table: enemy type -> soul form
  const POSS = {
    zombie: e => ({ form: 'zombie', set: e.v || 'zombie' }), skeleton: () => ({ form: 'skeleton', set: 'skeleton' }), swords: () => ({ form: 'skeleton', set: 'swords' }),
    haunt: () => ({ form: 'haunt', set: 'haunt' }), imp: () => ({ form: 'imp', set: 'imp' }),
    arremer: () => ({ form: 'arremer', set: 'arremer_red' }), gargoyle: () => ({ form: 'arremer', set: 'arremer_stone' }),
    lemming: () => ({ form: 'lemming', set: 'lemming' }), blocker: () => ({ form: 'lemming', set: 'lemming' }),
  };

  function bind(s) { S = s; }
  return { D, create, bind, POSS };
})();
window.Ents = Ents;
