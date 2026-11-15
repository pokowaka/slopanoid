/* Solution scripts: the intended route of every level, written as rules.
 * `node tools/solve.js` plays them through the real simulation and writes the
 * frame-exact recordings to js/solutions.js. See tools/lib.js for the rule format. */
'use strict';
const S = { FALL: 0, WALK: 1, CLIMB: 2, HOIST: 3, FLOAT: 4, BUILD: 5, SHRUG: 6, BASH: 7, MINE: 8, DIG: 9, BLOCK: 10 };
// nuke once nobody but blockers is left and the hatch is empty
const onlyBlockers = sim => sim.spawned >= sim.num && sim.lems.every(l => l.st === 16 || l.st === S.BLOCK);

const WALK = S.WALK;
const find = (sim, f) => sim.lems.find(f) || null;
// a lemming standing right against a wall it cannot step over
const atFace = (sim, x0, x1) => find(sim, l => l.st === WALK && l.dir === 1 && l.x >= x0 && l.x <= x1 && sim.T.solid(l.x + 1, l.y) && sim.T.solid(l.x + 1, l.y - 6));
// "park a blocker against the rock, then bomb it" - repeated until the way is open
function bombPairs(n, x0, x1) {
  const r = [];
  for (let i = 0; i < n; i++) {
    r.push({ optional: true, pick: sim => (!sim.blockers.length && !sim.lems.some(l => l.st === 11 || l.fuse >= 0)) ? atFace(sim, x0, x1) : null, skill: 'blocker' });
    r.push({ optional: true, st: 'BLOCK', pick: sim => sim.blockers.find(b => b.fuse < 0) || null, skill: 'bomber' });
  }
  return r;
}

module.exports = {
  'T': [
    { l: 0, x: 170, skill: 'digger', beat: true }
  ],
  '1-1': [
    { l: 0, x: 398, skill: 'builder', beat: true }
  ],
  '1-2': [
    { l: 0, x: 243, skill: 'basher' },
    { l: 0, x: 462, skill: 'basher' },
    { l: 0, x: 634, skill: 'builder', beat: true }
  ],
  '1-3': [
    { l: 0, x: 478, skill: 'blocker' },
    { l: 1, x: 342, dir: -1, skill: 'blocker' },
    { l: 2, x: 420, dir: -1, skill: 'digger', beat: true },
    { nuke: true, when: onlyBlockers }
  ],
  '2-1': [
    { l: 0, x: 150, skill: 'climber', beat: true },
    { l: 0, x: 190, skill: 'floater', beat: true },
    { l: 0, x: 347, dir: -1, skill: 'basher' },
    { pick: sim => sim.skills.basher === 1 ? find(sim, l => l.st === WALK && l.dir === 1 && l.x >= 412 && l.x <= 419) : null, skill: 'basher' }
  ],
  '2-2': [
    { l: 0, x: 232, skill: 'miner', beat: true },
    { l: 0, x: 569, skill: 'basher' }
  ],
  '2-3': (() => {
    const m = {};            // whoever leaves the tunnel first is the bridge builder, the next one blocks
    const lead = sim => m.b !== undefined ? sim.lems[m.b] : null;
    return [
      { l: 0, x: 300, skill: 'digger', beat: true },
      { l: 0, when: l => l.st === S.DIG && l.y >= 99, skill: 'basher' },
      { pick: sim => {
        if (m.b === undefined) { const l = find(sim, q => q.st === WALK && q.dir === 1 && q.y > 120 && q.x >= 636); if (l) m.b = l.i; return null; }
        return find(sim, l => l.i !== m.b && l.st === WALK && l.dir === 1 && l.y > 120 && l.x >= 636 && l.x <= 646);
      }, skill: 'blocker' },
      { pick: lead, when: l => l.st === WALK && l.dir === 1 && l.x >= 694, skill: 'builder' },
      { pick: lead, when: (l, sim) => l.st === S.SHRUG && sim.skills.builder === 4, skill: 'builder' },
      { pick: lead, when: (l, sim) => l.st === S.SHRUG && sim.skills.builder === 3, skill: 'builder' },
      { st: 'BLOCK', pick: sim => (sim.skills.builder === 2 && lead(sim) && lead(sim).x > 764) ? sim.blockers[0] : null, skill: 'bomber' }
    ];
  })(),
  '3-1': [
    { l: 0, x: 262, skill: 'miner', beat: true },
    { l: 0, when: l => l.st === WALK && l.dir === 1 && l.y > 120 && l.x >= 592, skill: 'bomber' }
  ],
  '3-2': [
    { l: 0, when: l => l.st === WALK && l.x <= 44, skill: 'blocker' },
    { l: 1, x: 412, skill: 'basher' },
    { l: 1, x: 752, skill: 'basher' },
    { l: 1, x: 1016, skill: 'builder', beat: true },
    { nuke: true, when: onlyBlockers }
  ],
  '3-3': [
    { l: 0, x: 130, skill: 'climber', beat: true },
    { l: 0, when: l => l.st === WALK && l.dir === 1 && l.y > 120 && l.x >= 508 && l.x < 520, skill: 'builder' },
    { l: 0, when: l => l.st === S.SHRUG && l.x < 560, skill: 'builder' },
    { l: 1, when: (l, sim) => sim.lems[0] && sim.lems[0].x > 524 && l.st === WALK && l.dir === 1 && l.x >= 258 && l.x <= 268, skill: 'builder' },
    { l: 1, when: l => l.st === S.SHRUG && l.x < 300, skill: 'builder' },
    { l: 0, when: l => l.st === WALK && l.dir === 1 && l.x >= 814 && l.x < 830, skill: 'builder' }
  ],
  '4-1': [
    { l: 0, x: 160, skill: 'climber', beat: true },
    { l: 0, when: l => l.st === WALK && l.dir === -1 && l.y < 110 && l.x <= 466 && l.x >= 450, skill: 'miner' },
    { pick: sim => sim.skills.miner === 0 ? find(sim, l => l.st === WALK && l.dir === 1 && l.y < 110 && l.x >= 552 && l.x <= 559) : null, skill: 'basher' }
  ],
  '4-2': [
    { l: 0, x: 140, skill: 'climber', beat: true },
    { l: 0, x: 170, skill: 'floater', beat: true },
    { l: 0, when: l => l.st === WALK && l.dir === -1 && l.y > 130 && l.x <= 446, skill: 'builder' },
    { l: 0, when: (l, sim) => l.st === S.SHRUG && sim.skills.builder === 3, skill: 'builder' },
    { l: 0, when: (l, sim) => l.st === S.SHRUG && sim.skills.builder === 2, skill: 'builder' },
    { pick: sim => (sim.skills.builder === 1 && sim.lems[0] && sim.lems[0].st === WALK) ? find(sim, l => l.i !== 0 && l.st === WALK && l.dir === 1 && l.y < 60 && l.x >= 292 && l.x <= 299) : null, skill: 'basher' },
    { pick: sim => sim.skills.basher === 1 ? find(sim, l => l.st === WALK && l.dir === 1 && l.y > 130 && l.x >= 512 && l.x <= 519) : null, skill: 'basher' }
  ],
  '4-3': bombPairs(6, 280, 540),
  '5-1': [
    { l: 0, x: 150, skill: 'climber', beat: true },
    { l: 0, when: l => l.st === WALK && l.dir === 1 && l.x >= 528 && l.x < 540, skill: 'builder' },
    { l: 0, when: l => l.st === S.SHRUG && l.x < 600, skill: 'builder' },
    { pick: sim => sim.lems[0] && sim.lems[0].x > 580 ? find(sim, l => l.i !== 0 && l.st === WALK && l.dir === 1 && l.x >= 272 && l.x <= 279) : null, skill: 'basher' },
    { pick: sim => sim.skills.basher === 1 ? find(sim, l => !l.climber && l.st === WALK && l.dir === 1 && l.x >= 752 && l.x <= 759) : null, skill: 'basher' }
  ],
  '5-2': [
    { l: 0, x: 200, skill: 'miner', beat: true },
    { l: 0, when: l => l.st === WALK && l.dir === 1 && l.y > 100 && l.x >= 372, skill: 'digger' },
    { l: 0, when: (l, sim) => l.st === WALK && l.dir === 1 && l.y >= 136 && l.x < 420 && sim.skills.digger === 1, skill: 'basher' },
    { l: 0, when: l => l.st === WALK && l.dir === 1 && l.y > 140 && l.x >= 778, skill: 'builder' },
    { l: 0, when: l => l.st === S.SHRUG, skill: 'builder' }
  ],
  '5-3': [
    { l: 0, x: 228, skill: 'blocker' },
    { pick: sim => find(sim, l => l.st === WALK && l.dir === -1 && l.y < 60 && l.x <= 92), skill: 'blocker' },
    { l: 2, x: 168, skill: 'miner' },
    { l: 2, when: l => l.st === WALK && l.y > 120 && l.x >= 300, skill: 'climber' },
    { l: 2, when: l => l.st === WALK && l.y > 120 && l.x >= 310, skill: 'floater' },
    { l: 2, when: l => l.st === WALK && l.dir === 1 && l.x >= 588 && l.x < 600, skill: 'builder' },
    { l: 2, when: l => l.st === S.SHRUG && l.x < 660, skill: 'builder' },
    { pick: sim => sim.lems[2] && sim.lems[2].x > 640 ? find(sim, l => l.i > 2 && l.st === WALK && l.dir === 1 && l.y > 120 && l.x >= 432 && l.x <= 439) : null, skill: 'basher' },
    { l: 2, when: l => l.st === WALK && l.dir === 1 && l.x >= 712 && l.x < 760, skill: 'digger' },
    { l: 2, when: (l, sim) => l.st === WALK && l.dir === 1 && l.y >= 150 && l.x < 760 && sim.skills.digger === 0, skill: 'basher' },
    // wait until the pioneer has climbed over the last wall, then park a blocker against it
    { pick: sim => (sim.lems[2] && (sim.lems[2].x > 1010 || sim.lems[2].st === 16)) ? atFace(sim, 990, 999) : null, when: l => !l.climber, skill: 'blocker' },
    { st: 'BLOCK', pick: sim => sim.blockers.find(b => b.x > 900) || null, skill: 'bomber' },
    { nuke: true, when: onlyBlockers }
  ]
};
