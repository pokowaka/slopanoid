/* ============================================================================
 * js/sprites.js
 * Multi-Frame CPS-1 / EGA-VGA Pixel-Art Sprite Compiler & Animation Bank
 * - Sir Arthur (Steel, Strawberry Boxer-Shorts, Golden Armor + Flowing Cape,
 *   Armor-Shatter Pop, Crouch, Ladder Climb, Upward/Horizontal Throw, Bone Pile)
 * - Ejected Armor Anvil, 5 Weapons + Creeping Blue Flames, Chests (Normal,
 *   Spectral, Magician), Zombies, Skeletons, Red Arremer Gargoyles, Haunted
 *   Armor, Voodoo Skulls, Lemming Blockers, Cyber-Imps & Multi-Part Bosses
 * ============================================================================ */
(function () {
  'use strict';

  const GNG = (window.GNG = window.GNG || {});
  const hex = GNG.hexToCol;

  const OUTLINE = hex('#08090d');

  const PAL = {
    '.': 0,
    'o': OUTLINE,
    // Metals (Steel / Silver)
    'W': hex('#f6f8fc'),
    'S': hex('#c3ccd9'),
    's': hex('#8390a3'),
    'd': hex('#4c5566'),
    // Gold / Brass
    'Y': hex('#fff29c'),
    'G': hex('#ecc146'),
    'g': hex('#a8791d'),
    // Skin & Hair / Beard
    'F': hex('#f5c49b'),
    'f': hex('#c98d63'),
    'H': hex('#9c5525'),
    'h': hex('#5e2f11'),
    // Crimson / Plume / Cape / Strawberry Red
    'R': hex('#eb4034'),
    'r': hex('#9c1e18'),
    // Strawberry Leaf / Zombie / Slime Green
    'L': hex('#57d95b'),
    'l': hex('#288a36'),
    'z': hex('#7da868'),
    'Z': hex('#4b6e3c'),
    // Bone / Parchment
    'B': hex('#f0e9d8'),
    'b': hex('#b5ab94'),
    // Wood / Leather
    'M': hex('#9e6431'),
    'm': hex('#5c3616'),
    // Holy Water / Spectral Cyan / Blue Fire
    'C': hex('#8cf7ff'),
    'c': hex('#2ec4d6'),
    'u': hex('#1b6ca8'),
    // Demon / Cursed Ember Orange
    'O': hex('#ff9c38'),
    'a': hex('#d14e1b'),
    // Stone Grey
    'K': hex('#9498a1'),
    'k': hex('#595d66')
  };

  function compileGrid(rows, customMap, addOutline) {
    const h = rows.length;
    let w = 0;
    for (let y = 0; y < h; y++) {
      if (rows[y].length > w) w = rows[y].length;
    }
    const pad = addOutline ? 1 : 0;
    const outW = w + pad * 2;
    const outH = h + pad * 2;
    const data = new Uint32Array(outW * outH);

    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = (customMap && customMap[ch] !== undefined) ? customMap[ch] : PAL[ch];
        if (col) {
          data[(y + pad) * outW + (x + pad)] = col;
        }
      }
    }

    if (addOutline) {
      const copy = new Uint32Array(data);
      for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) {
          if (copy[y * outW + x] !== 0) continue;
          const n =
            (y > 0 && copy[(y - 1) * outW + x] !== 0) ||
            (y < outH - 1 && copy[(y + 1) * outW + x] !== 0) ||
            (x > 0 && copy[y * outW + x - 1] !== 0) ||
            (x < outW - 1 && copy[y * outW + x + 1] !== 0);
          if (n) {
            data[y * outW + x] = OUTLINE;
          }
        }
      }
    }

    return { w: outW, h: outH, data };
  }

  // --- SIR ARTHUR BASE GRIDS (14x20 inner -> 16x22 outlined) ---
  function buildArthurArmorSet(isGold) {
    const map = isGold
      ? { W: PAL.Y, S: PAL.G, s: PAL.g, d: PAL.m }
      : null;

    const helmTopA = isGold
      ? [
          '..Rrr...Y..Y..',
          '.RRRRr..YYYY..',
          '..rRR..WSSSSW.',
          '......SSdFFdSS',
          '......SdFFFFdS',
          '......SFFHHFFS'
        ]
      : [
          '..Rrr.........',
          '.RRRRr..WWWW..',
          '..rRr..WSSSSW.',
          '......SSsFFsSS',
          '......SsFFFFsS',
          '......SFFHHFFS'
        ];

    const helmTopB = isGold
      ? [
          '...Rrr..Y..Y..',
          '..RRRR..YYYY..',
          '...rR..WSSSSW.',
          '......SSdFFdSS',
          '......SdFFFFdS',
          '......SFFHHFFS'
        ]
      : [
          '...Rrr........',
          '..RRRR..WWWW..',
          '...rR..WSSSSW.',
          '......SSsFFsSS',
          '......SsFFFFsS',
          '......SFFHHFFS'
        ];

    const capeIdleA = isGold
      ? [
          '...rr..HHHHHH.',
          '..rRR.WSSSSSSW',
          '.rRRR.SSSSSSSS',
          '.rRRr.SSsYYsSS',
          'rRRr..sSSSSSSs',
          'rRr....MMMMMM.',
          '.r....SSSSSSSS',
          '......SSs..sSS'
        ]
      : [
          '.......HHHHHH.',
          '......WSSSSSSW',
          '.....SSSSSSSSS',
          '.....SSSsSSsSS',
          '......sSSSSSSs',
          '.......MMMMMM.',
          '......SSSSSSSS',
          '......SSs..sSS'
        ];

    const capeIdleB = isGold
      ? [
          '..rr...HHHHHH.',
          '.rRRR.WSSSSSSW',
          '.rRRR.SSSSSSSS',
          'rRRRr.SSsYYsSS',
          '.rRR..sSSSSSSs',
          '..rr...MMMMMM.',
          '......SSSSSSSS',
          '......SSs..sSS'
        ]
      : capeIdleA;

    const legsStand = [
      '......SS....SS',
      '......ss....ss',
      '......dd....dd',
      '.....SSW....SSW'
    ];

    const legsRun0 = [
      '....SS......SS',
      '...SSs.......ss',
      '..SSW........dd',
      '.............SSW'
    ];
    const legsRun1 = [
      '.....SS....SS.',
      '.....ss....SSs',
      '.....dd.....SSW',
      '.....SSW.......'
    ];
    const legsRun2 = [
      '......SS..SS..',
      '......ss...SSs',
      '......dd....SSW',
      '.....SSW.......'
    ];
    const legsRun3 = [
      '....SS....SS..',
      '...ss.....ss..',
      '..SSW.....dd..',
      '..........SSW.'
    ];

    const idle0 = compileGrid(helmTopA.concat(capeIdleA, legsStand), map, true);
    const idle1 = compileGrid(helmTopB.concat(capeIdleB, legsStand), map, true);

    const runCape0 = isGold
      ? [
          '..rRr..HHHHHH.',
          '.rRRR.WSSSSSSW',
          'rRRRR.SSSSSSSS',
          'rRRr..SSsYYsSS',
          'rRr...sSSSSSSs',
          '.......MMMMMM.',
          '......SSSSSSSS',
          '.....SSs...sSS'
        ]
      : capeIdleA;
    const runCape1 = isGold
      ? [
          '.rRRr..HHHHHH.',
          'rRRRR.WSSSSSSW',
          '.rRRR.SSSSSSSS',
          '..rRr.SSsYYsSS',
          '...r..sSSSSSSs',
          '.......MMMMMM.',
          '......SSSSSSSS',
          '.....SSs...sSS'
        ]
      : capeIdleA;

    const run = [
      compileGrid(helmTopA.concat(runCape0, legsRun0), map, true),
      compileGrid(helmTopB.concat(runCape1, legsRun1), map, true),
      compileGrid(helmTopA.concat(runCape0, legsRun2), map, true),
      compileGrid(helmTopB.concat(runCape1, legsRun3), map, true)
    ];

    const jumpRows = helmTopA.concat(
      isGold
        ? [
            '.rRRr..HHHHHH.',
            'rRRRRWSSSSSSSS',
            'rRRR.SSSSSSSSW',
            '.rRr..sSSSSSSs',
            '.......MMMMMM.',
            '.....SSSS..SSSS',
            '....SSW.....SSW',
            '...............'
          ]
        : [
            '.......HHHHHH.',
            '.....WSSSSSSSS',
            '.....SSSSSSSSW',
            '......sSSSSSSs',
            '.......MMMMMM.',
            '.....SSSS..SSSS',
            '....SSW.....SSW',
            '...............'
          ]
    );
    const jump = compileGrid(jumpRows, map, true);

    const crouchRows = helmTopB.concat([
      isGold ? '.rRRr..HHHHHH.' : '.......HHHHHH.',
      isGold ? 'rRRRR.WSSSSSSW' : '......WSSSSSSW',
      isGold ? '.rRR..SSSSSSSS' : '......SSSSSSSS',
      '......sSSSSSSs',
      '.....SSSS..SSSS',
      '....SSWW...SSWW'
    ]);
    const crouch = compileGrid(crouchRows, map, true);

    const throwRows = helmTopA.concat([
      '.......HHHHHH.',
      '....WWSSSSSSSS',
      '...SSSSSSSSFFW',
      '......sSSSSSS.',
      '.......MMMMMM.',
      '......SSSSSSSS',
      '.....SSs....sSS',
      '.....SS......SS',
      '.....dd......dd',
      '....SSW......SSW'
    ]);
    const throwStand = compileGrid(throwRows, map, true);

    const throwUpRows = [
      '..........FFW.',
      '..Rrr....WSS..',
      '.RRRRr.WWSSSS.',
      '......SSsFFsSS',
      '......SsFFFFsS',
      '......SFFHHFFS',
      '.......HHHHHH.',
      '......WSSSSSSW',
      '......SSSSSSSS',
      '......sSSSSSSs',
      '.......MMMMMM.',
      '......SSSSSSSS',
      '......SS....SS',
      '......ss....ss',
      '......dd....dd',
      '.....SSW....SSW'
    ];
    const throwUp = compileGrid(throwUpRows, map, true);

    const throwCrouchRows = helmTopB.concat([
      '.......HHHHHH.',
      '.....WSSSSSSSS',
      '.....SSSSSSFFW',
      '......sSSSSSS.',
      '.....SSSS..SSSS',
      '....SSWW...SSWW'
    ]);
    const throwCrouch = compileGrid(throwCrouchRows, map, true);

    const climb0 = compileGrid([
      '.....WWWWWW...',
      '....SSSSSSSS..',
      '....SSsddssS..',
      '...FF.SSSS..FF',
      '....WSSSSSSW..',
      '....SSSSSSSS..',
      '....sSSSSSSs..',
      '.....MMMMMM...',
      '....SSS..SSS..',
      '....SS....ss..',
      '...SSW....dd..',
      '..........SSW.'
    ], map, true);

    const climb1 = compileGrid([
      '.....WWWWWW...',
      '....SSSSSSSS..',
      '....SSsddssS..',
      '...FF..SSSS.FF',
      '....WSSSSSSW..',
      '....SSSSSSSS..',
      '....sSSSSSSs..',
      '.....MMMMMM...',
      '....SSS..SSS..',
      '....ss....SS..',
      '....dd....SSW.',
      '...SSW........'
    ], map, true);

    return {
      idle: [idle0, idle1],
      run,
      jump,
      crouch,
      throw: throwStand,
      throwUp,
      throwCrouch,
      climb: [climb0, climb1]
    };
  }

  // --- SIR ARTHUR IN STRAWBERRY BOXER SHORTS! ---
  function buildArthurBoxersSet() {
    const headA = [
      '......HHHHHH..',
      '.....HHHHHHHH.',
      '.....HHFFFFHH.',
      '.....FFFFFFFF.',
      '.....FFoFFoFF.',
      '.....FFHHHHFF.',
      '......HHHHHH..'
    ];
    // Bare chest + WHITE BOXERS WITH RED/GREEN STRAWBERRIES (R + L)!
    const torsoBoxerA = [
      '.....FFFFFFFF.',
      '....FFFFfFFFFF',
      '.....fFFFFFFf.',
      '.....WWWWWWWW.',
      '....WWWRWLWWWW',
      '....WWRWWWRWWW',
      '....WWWWLWWWRW'
    ];
    const torsoBoxerB = [
      '....FFFFFFFFFF',
      '...FF.FFFFFF.FF',
      '.....fFFFFFFf.',
      '.....WWWWWWWW.',
      '....WWRWWLWWWW',
      '....WWWWRWWRWW',
      '....WWLWWWWWWW'
    ];

    const legsIdle = [
      '.....FF....FF.',
      '.....FF....FF.',
      '.....ff....ff.',
      '....MMM....MMM'
    ];
    const legsRun0 = [
      '...FF.......FF',
      '..FF.........ff',
      '.MMM.........MM',
      '...............'
    ];
    const legsRun1 = [
      '....FF.....FF.',
      '....ff.....FF.',
      '....MMM.....MMM',
      '...............'
    ];
    const legsRun2 = [
      '.....FF...FF..',
      '.....ff....FF.',
      '....MMM.....MMM',
      '...............'
    ];
    const legsRun3 = [
      '...FF.....FF..',
      '..ff......ff..',
      '.MMM......MMM.',
      '...............'
    ];

    const idle = [
      compileGrid(headA.concat(torsoBoxerA, legsIdle), null, true),
      compileGrid(headA.concat(torsoBoxerB, legsIdle), null, true)
    ];

    const run = [
      compileGrid(headA.concat(torsoBoxerA, legsRun0), null, true),
      compileGrid(headA.concat(torsoBoxerB, legsRun1), null, true),
      compileGrid(headA.concat(torsoBoxerA, legsRun2), null, true),
      compileGrid(headA.concat(torsoBoxerB, legsRun3), null, true)
    ];

    const jump = compileGrid(
      headA.concat([
        '...FF.FFFFFF.FF',
        '.....fFFFFFFf.',
        '.....WWWWWWWW.',
        '....WWWRWLWWWW',
        '....WWRWWWRWWW',
        '....FFF....FFF',
        '...MMM......MMM'
      ]),
      null,
      true
    );

    const crouch = compileGrid(
      headA.concat([
        '.....FFFFFFFF.',
        '.....WWWWWWWW.',
        '....WWWRWLWWWW',
        '....FFF....FFF',
        '...MMMM....MMMM'
      ]),
      null,
      true
    );

    const throwStand = compileGrid(
      headA.concat([
        '....FFFFFFFFFFW',
        '.....fFFFFFF..',
        '.....WWWWWWWW.',
        '....WWWRWLWWWW',
        '....WWRWWWRWWW',
        '.....FF....FF.',
        '.....ff....ff.',
        '....MMM....MMM'
      ]),
      null,
      true
    );

    const throwUp = compileGrid(
      [
        '..........FFF.',
        '......HHHHFF..',
        '.....HHHHHHFF.',
        '.....HHFFFFHH.',
        '.....FFFFFFFF.',
        '.....FFHHHHFF.',
        '......HHHHHH..',
        '.....FFFFFFFF.',
        '.....fFFFFFFf.',
        '.....WWWWWWWW.',
        '....WWWRWLWWWW',
        '....WWRWWWRWWW',
        '.....FF....FF.',
        '.....ff....ff.',
        '....MMM....MMM'
      ],
      null,
      true
    );

    const throwCrouch = compileGrid(
      headA.concat([
        '....FFFFFFFFFFW',
        '.....WWWWWWWW.',
        '....WWWRWLWWWW',
        '....FFF....FFF',
        '...MMMM....MMMM'
      ]),
      null,
      true
    );

    const climb0 = compileGrid([
      '....HHHHHHHH..',
      '....HHHHHHHH..',
      '...FF.FFFF..FF',
      '....FFFFFFFF..',
      '....WWWWWWWW..',
      '....WWRWWLWW..',
      '....WWWRWWWW..',
      '....FF....ff..',
      '...MMM....MMM.'
    ], null, true);

    const climb1 = compileGrid([
      '....HHHHHHHH..',
      '....HHHHHHHH..',
      '...FF..FFFF.FF',
      '....FFFFFFFF..',
      '....WWWWWWWW..',
      '....WWLWWWRW..',
      '....WWRWWWWW..',
      '....ff....FF..',
      '...MMM....MMM.'
    ], null, true);

    return {
      idle,
      run,
      jump,
      crouch,
      throw: throwStand,
      throwUp,
      throwCrouch,
      climb: [climb0, climb1]
    };
  }

  function buildAllSprites() {
    const S = {};

    S.arthurSteel = buildArthurArmorSet(false);
    S.arthurGold = buildArthurArmorSet(true);
    S.arthurBoxers = buildArthurBoxersSet();

    // Armor-Shatter Shocked Pose
    S.arthurShatter = compileGrid([
      '.W....HHHHHH...S',
      'SS...HHHHHHHH.SS',
      '.....HHFFFFHH...',
      '....FFoFFFFoFF..',
      '.....FFooooFF...',
      '..S..FFFFFFFF..W',
      '.SS.FF.FFFF.FF..',
      '.....WWWWWWWW...',
      '....WWWRWLWWWW..',
      '.W..WWRWWWRWWW.S',
      '....FF......FF..',
      '...MMM......MMM.'
    ], null, true);

    // Classic Bone Pile Death
    S.arthurBonePile = compileGrid([
      '....BBBBBB....',
      '...BBBBBBBB...',
      '...BBoBBoBB...',
      '....BBooBB....',
      '..BB.BBBB.BB..',
      '.BBBBbBBbBBBB.',
      'BBBBbBBBBbBBBB'
    ], null, true);

    // Ejected Heavy Decoy Armor Anvil (+ Springboard Squash Frame)
    S.armorAnvil = compileGrid([
      '....Rrr.......',
      '...RRRR..WWWW.',
      '....rR..WSSSSW',
      '.......SSddddS',
      '....WWSSSSSSSS',
      '...WSSSSSSSSSW',
      '...SSsWWWWsSSS',
      '...sSSSSSSSSSs',
      '..dddddddddddd',
      '..SSSSSSSSSSSS'
    ], null, true);

    S.armorAnvilSquash = compileGrid([
      '...RRRR..WWWW.',
      '..WWSSSSSSSSSW',
      '.WSSSSSSSSSSSW',
      '.SSsWWWWWWsSSS',
      '.dddddddddddd.',
      'SSSSSSSSSSSSSS'
    ], null, true);

    // --- 5 WEAPONS ---
    S.lanceH = compileGrid([
      '......sSWWW...',
      'MMMMMMSSWWWWWW',
      '......sSWWW...'
    ], null, true);

    S.lanceV = compileGrid([
      '.W.',
      'WWW',
      'WSW',
      'SSS',
      '.M.',
      '.M.',
      '.M.',
      '.M.',
      '.M.'
    ], null, true);

    S.daggerH = compileGrid([
      '..g........',
      'MMGWWWWWWWW',
      '..g........'
    ], null, true);

    S.daggerV = compileGrid([
      '.W.',
      'WWW',
      '.S.',
      'gGg',
      '.M.',
      '.M.'
    ], null, true);

    S.torch = [
      compileGrid([
        '..CC..',
        '.CCCC.',
        '..uu..',
        '..MM..',
        '..mm..'
      ], null, true),
      compileGrid([
        '......',
        '.MMCC.',
        '.mmCCC',
        '...uu.',
        '......'
      ], null, true)
    ];

    S.blueFlame = [
      compileGrid([
        '...C....',
        '..CCC...',
        '.CCWCc..',
        '.cCWCCc.',
        'ccWWWCcc',
        'uuuuuuuu'
      ], null, true),
      compileGrid([
        '....C...',
        '..cCCc..',
        '.CCWWCC.',
        'cCWWWWCc',
        'ccuWWucc',
        'uuuuuuuu'
      ], null, true),
      compileGrid([
        '..C..C..',
        '.CCcCCC.',
        '.cCWWCc.',
        'ccWWWWcc',
        'uuuuuuuu'
      ], null, true)
    ];

    S.axe = [
      compileGrid([
        '..WWWW..',
        '.WSSSSW.',
        'WSSMMSSW',
        '.W.MM.W.',
        '...MM...',
        '...mm...'
      ], null, true),
      compileGrid([
        '...WW...',
        '..mSSW..',
        '.MMSSSW.',
        '...SSSW.',
        '...WW...'
      ], null, true)
    ];

    S.cross = [
      compileGrid([
        '...YY...',
        '...GG...',
        'YYGGGGYY',
        'GGGGWGGG',
        '...GG...',
        '...YY...'
      ], null, true),
      compileGrid([
        '.Y....Y.',
        '..GGGG..',
        '..GWWG..',
        '..GGGG..',
        '.Y....Y.'
      ], null, true)
    ];

    // Pickups & Chests
    S.chestClosed = compileGrid([
      '..GGGGGGGGGG..',
      '.GMMMMMMMMMMG.',
      'GMMMMMMMMMMMMG',
      'GGGGGGYYGGGGGG',
      'GmmmmGYYGmmmmG',
      'GmmmmGGGGmmmmG',
      'GGGGGGGGGGGGGG'
    ], null, true);

    S.chestSpectral = compileGrid([
      '..CCCCCCCCCC..',
      '.CuuuuuuuuuuC.',
      'CuuccccccccuuC',
      'CCCCCCWWCCCCCC',
      'CuuuuCWWCuuuuC',
      'CCCCCCCCCCCCCC'
    ], null, true);

    S.chestMagician = compileGrid([
      '..YYYYYYYYYY..',
      '.YGGGGGGGGGGY.',
      'YGRRRRYYRRRRGY',
      'YYYYYYYYYYYYYY',
      'YGrrrrYYrrrrGY',
      'YGGGGGGGGGGGGY',
      'YYYYYYYYYYYYYY'
    ], null, true);

    S.chestOpen = compileGrid([
      '.GmmmmmmmmmmG.',
      'GGGGGGGGGGGGGG',
      '..............',
      'GGGGGGYYGGGGGG',
      'GmmmmG..GmmmmG',
      'GGGGGGGGGGGGGG'
    ], null, true);

    S.pickupSteelArmor = compileGrid([
      '...WWWW...',
      '..WSSSSW..',
      '.WSSSSSSW.',
      '.SSsWWsSS.',
      '..SSSSSS..',
      '..GG..GG..'
    ], null, true);

    S.pickupGoldArmor = compileGrid([
      '..Y.YY.Y..',
      '..YYYYYY..',
      '.YGGGGGGY.',
      'rRGGYYGGRr',
      '.rGGGGGG..',
      '..YY..YY..'
    ], null, true);

    S.potionRed = compileGrid([
      '...WW...',
      '...ss...',
      '..RRRR..',
      '.RRWRRR.',
      '.RRRRRR.',
      '..rrrr..'
    ], null, true);

    S.clayPot = compileGrid([
      '..MMMM..',
      '...mm...',
      '.MMMMMM.',
      'MMOMMMMm',
      '.mmmmmm.'
    ], null, true);

    // --- UNDEAD ENEMIES ---
    // 1. Rising Zombie & Shambling Zombie (+ Pirate Buccaneer Bandana)
    S.zombieRise = [
      compileGrid([
        '....zz....',
        '...zzzz...',
        '....ZZ....',
        '..mmmmmm..'
      ], null, true),
      compileGrid([
        '...zzzzzz...',
        '..zzRoRzzz..',
        '...zzzzzz...',
        '..ZzzzzzzZ..',
        '.mmmmmmmmmm.'
      ], null, true),
      compileGrid([
        '...RRRRRR...',
        '..zzzzzzzz..',
        '..zzRoRzzz..',
        '...zzoozz...',
        '..kddddddk..',
        '..zzzzzzzz..',
        '.mmmmmmmmmm.'
      ], null, true)
    ];

    S.zombieWalk = [
      compileGrid([
        '...RRRRRRr..',
        '..zzzzzzzzr.',
        '..zzRoRzzz..',
        '...zzoozz...',
        '..zzzzzzzz..',
        '.zzkddddk...',
        '...kddddk...',
        '...dd..dd...',
        '..ZZ....ZZ..',
        '.mm......mm.'
      ], null, true),
      compileGrid([
        '...RRRRRRr..',
        '..zzzzzzzzr.',
        '..zzRoRzzz..',
        '...zzoozz...',
        '..zzzzzzzz..',
        '..zzddddk...',
        '...kddddk...',
        '....dd.dd...',
        '....ZZ..ZZ..',
        '...mm....mm.'
      ], null, true)
    ];

    S.zombieBurrow = compileGrid([
      '...zz..zz...',
      '..mmmmmmmm..',
      '.mMMmmmmMMm.'
    ], null, true);

    // 2. Bone-Throwing Skeleton & Stage 3 Skeleton Swordsman
    S.skeletonWalk = [
      compileGrid([
        '...BBBBBB...',
        '..BBBBBBBB..',
        '..BBRoBRBB..',
        '...BBooBB...',
        '....bBBb....',
        '..BBBBBBBB..',
        '.BB.bBBb.BB.',
        '....BBBB....',
        '...BB..BB...',
        '..BB....BB..',
        '.BB......BB.'
      ], null, true),
      compileGrid([
        '...BBBBBB...',
        '..BBBBBBBB..',
        '..BBRoBRBB..',
        '...BBooBB...',
        '....bBBb....',
        '..BBBBBBBB..',
        '..BBbBBbBB..',
        '....BBBB....',
        '....BB.BB...',
        '...BB...BB..',
        '...BB....BB.'
      ], null, true)
    ];

    S.skelSwordWalk = [
      compileGrid([
        '...GGGGGG...',
        '..BBBBBBBB..',
        '..BBRoBRBB..',
        '....bBBb..WW',
        '.SSBBBBBBWW.',
        'SSS.bBBb.M..',
        '.SS.BBBB....',
        '...BB..BB...',
        '..BB....BB..'
      ], null, true),
      compileGrid([
        '...GGGGGG...',
        '..BBBBBBBB..',
        '..BBRoBRBB..',
        '....bBBb...W',
        '.SSBBBBBB.WW',
        'SSS.bBBb..M.',
        '.SS.BBBB....',
        '....BB.BB...',
        '...BB...BB..'
      ], null, true)
    ];

    S.boneProj = [
      compileGrid([
        'BB....BB',
        '.BBBBBB.',
        'BB....BB'
      ], null, true),
      compileGrid([
        '.BB..',
        '..BB.',
        '..BB.',
        '.BB..',
        'BB...'
      ], null, true)
    ];

    // 3. Swooping Red Arremer Gargoyle (Stone Statue + Perched + Wingbeats + Swoop Dive)
    const arremerFly0 = [
      '.r........r...',
      'RRr..Y..Y.RRr.',
      'RRRrRRRRRrRRR.',
      '.RRRRRRRRRRRR.',
      '..rRRYoYRRRr..',
      '....RRRRRR....',
      '...RRRRRRRR...',
      '....rRRRRr....',
      '...RR....RR...',
      '..YY......YY..'
    ];
    const arremerFly1 = [
      '......Y..Y....',
      '.....RRRRRR...',
      '....rRRYoYRR..',
      '.rRRRRRRRRRRr.',
      'RRRRRRRRRRRRRR',
      'RRr..RRRR..rRR',
      '....rRRRRr....',
      '...RR....RR...',
      '..YY......YY..'
    ];
    S.arremerFly = [
      compileGrid(arremerFly0, null, true),
      compileGrid(arremerFly1, null, true)
    ];

    S.arremerDive = compileGrid([
      'RRr..........',
      '.RRRr..Y..Y..',
      '..RRRRRRRRRR.',
      '...rRRRRYoYRR',
      '....RRRRRRRRW',
      '.....RR..RR..'
    ], null, true);

    S.arremerStatue = compileGrid(arremerFly1, {
      R: PAL.K,
      r: PAL.k,
      Y: PAL.S
    }, true);

    // 4. Towering Haunted Armor
    S.hauntedArmor = [
      compileGrid([
        '....Rrr.......',
        '...RRRR..SSSS.',
        '....rR..SddddS',
        '.......SdRRRRd',
        '..GG..WSSSSSSW',
        '.GGGG.SSSSSSSS',
        '.GGGG.SSddddSS',
        '.GGGG.sSSSSSSs',
        '..GG...dddddd.',
        '......SSSSSSSS',
        '.....SSd....dS',
        '.....SS......S',
        '....SSW.....SSW'
      ], null, true),
      compileGrid([
        '....Rrr.......',
        '...RRRR..SSSS.',
        '....rR..SddddS',
        '.......SdRRRRd',
        '..GG..WSSSSSSW',
        '.GGGG.SSSSSSSS',
        '.GGGG.SSddddSS',
        '.GGGG.sSSSSSSs',
        '..GG...dddddd.',
        '......SSSSSSSS',
        '......SSd..dSS',
        '......SS....SS',
        '.....SSW....SSW'
      ], null, true)
    ];

    // 5. Voodoo Flaming Skull
    S.voodooSkull = [
      compileGrid([
        '..L..LL..L..',
        '.LLLBBBBLLL.',
        'LLBBBBBBBBLL',
        '.LBBoBBoBBL.',
        '..BBBBBBBB..',
        '...B.BB.B...',
        '...BBBBBB...'
      ], null, true),
      compileGrid([
        '...LL..LL...',
        '..LBBBBBBLL.',
        '.LBBBBBBBBL.',
        '.LBBoBBoBBL.',
        '..BBBBBBBB..',
        '............',
        '...B.BB.B...'
      ], null, true)
    ];

    // 6. Exploding Lemming Blocker (Green Hair + Blue Tunic + STOP Hands!)
    S.lemmingBlocker = [
      compileGrid([
        '..LLLLLLLL..',
        '.LLLLLLLLLL.',
        '..LLFFFFLL..',
        'FF..FFFF..FF',
        'FF.uuuuuu.FF',
        '...uuuuuu...',
        '...uu..uu...',
        '..MMM..MMM..'
      ], null, true),
      compileGrid([
        '.LLLLLLLLLL.',
        '..LLLLLLLL..',
        '..LLFFFFLL..',
        'FF..FRRF..FF',
        'FF.uuuuuu.FF',
        '...uuuuuu...',
        '...uu..uu...',
        '..MMM..MMM..'
      ], null, true)
    ];

    // 7. Phobos Cyber-Imp
    S.cyberImp = [
      compileGrid([
        '..W...MM...W..',
        '...MMMMMMMM...',
        '...MMRRRRMM...',
        '..WMMMMMMMMW..',
        '.SSMMMMMMMMCO.',
        '.SS.MMMMMM.OO.',
        '....MM..MM....',
        '...mm....mm...'
      ], null, true),
      compileGrid([
        '..W...MM...W..',
        '...MMMMMMMM...',
        '...MMRRRRMM...',
        '..WMMMMMMMMW..',
        '.SSMMMMMMMM...',
        '..SSMMMMMM....',
        '...MM....MM...',
        '..mm......mm..'
      ], null, true)
    ];

    // Radioactive Nukage Barrel
    S.nukageBarrel = [
      compileGrid([
        '.kLLLLLLLLk.',
        'kLLLLWLLLLLk',
        'SSSSSSSSSSSS',
        'kddddddddddk',
        'kdYYdkdYYddk',
        'kddddddddddk',
        'SSSSSSSSSSSS',
        'kddddddddddk',
        '.kkkkkkkkkk.'
      ], null, true),
      compileGrid([
        '.kLLLLLLLLk.',
        'kLLLWLLLLWLk',
        'SSSSSSSSSSSS',
        'kddddddddddk',
        'kdYYdkdYYddk',
        'kddddddddddk',
        'SSSSSSSSSSSS',
        'kddddddddddk',
        '.kkkkkkkkkk.'
      ], null, true)
    ];

    // --- MULTI-PART STAGE BOSSES & FINAL BOSS ASTAROTH-LECHUCK-9000 ---
    // Ghost Pirate LeChuck / Demon Warlord Head
    S.bossPirateHead = compileGrid([
      '....dddddddd....',
      '..ddGGGGGGGGdd..',
      '.ddddRRddRRdddd.',
      'dddddddddddddddd',
      '...zzzzzzzzzz...',
      '..zzzRooooRzzz..',
      '...zzzzzzzzzz...',
      '..LLLLzzzzLLLL..',
      '.LLLLLLLLLLLLLL.',
      '..LLL.LLLL.LLL..'
    ], null, true);

    S.bossDragonHead = compileGrid([
      '..YY........YY..',
      '...YY.LLLL.YY...',
      '..LLLLLLLLLLLL..',
      '.LLLLRooooRLLLL.',
      'LLLLLLLLLLLLLLLL',
      'LLLLWWLLLLWWLLLL',
      '.LLLLLLLLLLLLLL.',
      '..WW..WW..WW....'
    ], null, true);

    S.bossSkelKing = compileGrid([
      '..Y..YY..YY..Y..',
      '..GGGGGGGGGGGG..',
      '..BBBBBBBBBBBB..',
      '.BBBRRRooRRRBBB.',
      '.BBBBBBBBBBBBBB.',
      '..BBBBooooBBBB..',
      '...BB.BBBB.BB...',
      '...BBBBBBBBBB...'
    ], null, true);

    // Final Boss: ASTAROTH-LECHUCK-9000 (Head + Belly Demon Mouth Torso + Cyber Claws)
    S.astarothHead = compileGrid([
      'Y..............Y',
      'YY...dddddd...YY',
      '.YYddGGGGGGddYY.',
      '..ddRRRRRRRRdd..',
      '...RRRRRRRRRR...',
      '..RRCCCCCCCCRR..',
      '..RRCWRRWWRC.R..',
      '...RRRRRRRRRR...',
      '..LLLRRRRRRLLL..',
      '..LLLLWWWWLLLL..'
    ], null, true);

    S.astarothTorsoClosed = compileGrid([
      '..RRRRRRRRRRRRRRRR..',
      '.RRRRssRRRRRRssRRRR.',
      'RRRRssCCCCCCCCssRRRR',
      'RRRRRRRRRRRRRRRRRRRR',
      '.RRRRYYRRRRRRYYRRRR.',
      '.RRRRoRRRRRRRRoRRRR.',
      '.RRRRWWWWWWWWWWWRRR.',
      '..RRRRRRRRRRRRRRRR..',
      '...rrrrRRRRRRrrrr...'
    ], null, true);

    S.astarothTorsoOpen = compileGrid([
      '..RRRRRRRRRRRRRRRR..',
      '.RRRRssRRRRRRssRRRR.',
      'RRRRssCCCCCCCCssRRRR',
      'RRRRRRRRRRRRRRRRRRRR',
      '.RRRRYYRRRRRRYYRRRR.',
      '.RRRWWooooooooWWRRR.',
      '.RRRooooooooooooRRR.',
      '.RRRWWooooooooWWRRR.',
      '..RRRRRRRRRRRRRRRR..'
    ], null, true);

    S.astarothClaw = compileGrid([
      '..SSSS..',
      '.SRRRRS.',
      'SRRRRRRS',
      'YY....YY',
      'Y......Y'
    ], null, true);

    // The Cursed 3.5" Floppy Disk (Final Prize!)
    S.cursedFloppy = compileGrid([
      'uuuuuuuuuuSSSSuu',
      'uuuuuuuuuuSooSuu',
      'uuuuuuuuuuSSSSuu',
      'uuuuuuuuuuuuuuuu',
      'uuWWWWWWWWWWWWuu',
      'uuWRRRRRRRRRRWuu',
      'uuWWWWWWWWWWWWuu',
      'uuWbbbbbbbbbbWuu',
      'uuWWWWWWWWWWWWuu',
      'uuuuuuuuuuuuuuuu'
    ], null, true);

    return S;
  }

  GNG.PAL = PAL;
  GNG.compileGrid = compileGrid;
  GNG.SPRITES = buildAllSprites();
})();
