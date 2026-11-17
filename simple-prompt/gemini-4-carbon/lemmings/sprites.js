/**
 * Lemmings: Beat Tribe — Procedural Amiga Pixel-Art Sprite Bank (sprites.js)
 * Generates all multi-frame 8-10px lemming animations, hatches, exits, and HUD icons in code.
 */
(function (root) {
  'use strict';

  const BeatTribe = root.BeatTribe = root.BeatTribe || {};
  const Font = BeatTribe.Font || (typeof require !== 'undefined' ? require('./font.js') : null);
  const { packRGBA, desaturateColor } = Font;

  // Classic Amiga OCS Lemmings Palette
  const PAL = {
    '.': 0, // transparent
    'G': packRGBA(36, 224, 56),    // bright green hair
    'g': packRGBA(18, 148, 34),    // dark green hair shadow
    'h': packRGBA(126, 255, 110),  // green hair highlight
    'S': packRGBA(255, 206, 168),  // skin face/hands
    's': packRGBA(214, 152, 112),  // skin shadow
    'B': packRGBA(46, 94, 242),    // classic blue robe
    'b': packRGBA(24, 48, 156),    // dark blue robe shadow
    'c': packRGBA(104, 154, 255),  // light blue robe highlight
    'T': packRGBA(132, 74, 38),    // boots / tool handle
    'M': packRGBA(206, 220, 238),  // steel pickaxe / shovel head
    'R': packRGBA(248, 52, 72),    // umbrella red / fire red
    'W': packRGBA(250, 250, 255),  // umbrella white / sparkle
    'Y': packRGBA(255, 224, 64),   // golden brick / flame core
    'O': packRGBA(255, 136, 32),   // orange flame / spark
    'K': packRGBA(42, 44, 52),     // char / dark outline
    'A': packRGBA(92, 214, 255)    // water bubble cyan
  };

  function compileAsciiFrame(rows, ox, oy) {
    const h = rows.length;
    const w = rows[0].length;
    const px = new Uint32Array(w * h);
    const pxSilent = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const c = PAL[row[x]] || 0;
        px[y * w + x] = c;
        pxSilent[y * w + x] = c ? desaturateColor(c, 0.85) : 0;
      }
    }
    return { w, h, ox, oy, px, pxSilent };
  }

  function mirrorFrame(frame) {
    const { w, h, ox, oy, px, pxSilent } = frame;
    const mPx = new Uint32Array(w * h);
    const mSilent = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        mPx[y * w + (w - 1 - x)] = px[y * w + x];
        mSilent[y * w + (w - 1 - x)] = pxSilent[y * w + x];
      }
    }
    return { w, h, ox: w - 1 - ox, oy, px: mPx, pxSilent: mSilent };
  }

  // Build directional animation (right-facing source -> auto-mirror left-facing)
  function makeAnim(asciiFrames, ox, oy) {
    const right = asciiFrames.map(rows => compileAsciiFrame(rows, ox, oy));
    const left = right.map(f => mirrorFrame(f));
    return { right, left, length: right.length };
  }

  // =========================================================================
  // 1. MULTI-FRAME LEMMING ANIMATIONS (8-10px tall, foot anchor at (ox, oy))
  // =========================================================================

  // WALK (8 frames, bouncy 9-10px stride)
  const WALK_FRAMES = [
    [
      '..hGGg..',
      '.gGGGSS.',
      '..gGSSS.',
      '...cBB..',
      '..SBBBc.',
      '...BBB..',
      '..bB.Bb.',
      '..T...T.',
      '........'
    ],
    [
      '........',
      '..hGGg..',
      '.gGGGSS.',
      '..gGSSS.',
      '...cBB..',
      '...BBBS.',
      '...bBB..',
      '..T..bT.',
      '........'
    ],
    [
      '........',
      '..hGGg..',
      '.gGGGSS.',
      '..gGSSS.',
      '...BBc..',
      '...BBBS.',
      '...BB...',
      '...TT...',
      '........'
    ],
    [
      '..hGGg..',
      '.gGGGSS.',
      '..gGSSS.',
      '...cBB..',
      '..SBBBc.',
      '...BBB..',
      '..bB.Bb.',
      '.T....T.',
      '........'
    ],
    [
      '..hGGg..',
      '.gGGGSS.',
      '..gGSSS.',
      '...cBB..',
      '...BBBS.',
      '...BBB..',
      '..Bb.Bb.',
      '..T...T.',
      '........'
    ],
    [
      '........',
      '..hGGg..',
      '.gGGGSS.',
      '..gGSSS.',
      '..SBcB..',
      '...BBB..',
      '...BBb..',
      '..Tb..T.',
      '........'
    ],
    [
      '........',
      '..hGGg..',
      '.gGGGSS.',
      '..gGSSS.',
      '..SBBc..',
      '...BBB..',
      '...BB...',
      '...TT...',
      '........'
    ],
    [
      '..hGGg..',
      '.gGGGSS.',
      '..gGSSS.',
      '...cBB..',
      '...BBBS.',
      '...BBB..',
      '..Bb.bB.',
      '.T....T.',
      '........'
    ]
  ];

  // FALL (4 frames, flailing arms, fluttering green hair)
  const FALL_FRAMES = [
    [
      '.hG..Gh.',
      '..GGGG..',
      '.S.SS.S.',
      '..SBBS..',
      '...BB...',
      '...BB...',
      '..b..b..',
      '.T....T.',
      '........'
    ],
    [
      '..hGGh..',
      '.SGGGGS.',
      '..SSSS..',
      '...BB...',
      '...BB...',
      '..bBBb..',
      '..T..T..',
      '........',
      '........'
    ],
    [
      '.Gh..hG.',
      '..GGGG..',
      '..SSSS..',
      '.S.BB.S.',
      '...BB...',
      '..b..b..',
      '.T....T.',
      '........',
      '........'
    ],
    [
      '..GGGG..',
      '.SGGGGS.',
      '..SSSS..',
      '...BB...',
      '..cBBc..',
      '..b..b..',
      '..T..T..',
      '........',
      '........'
    ]
  ];

  // FLOAT (6 frames: 0-1 opening red/white striped parasol, 2-5 gentle drift sway)
  const FLOAT_FRAMES = [
    [
      '...RW...',
      '..RWRW..',
      '...TT...',
      '..hGGg..',
      '..GGSS..',
      '...BB...',
      '..SBBS..',
      '...BB...',
      '..T..T..'
    ],
    [
      '..RWRWR.',
      '.RWRWRWR',
      '....T...',
      '..hGGg..',
      '..GGSS..',
      '...BBS..',
      '...BB...',
      '..b..b..',
      '..T..T..'
    ],
    [
      '.RWRWRWR',
      'RWRWRWRW',
      '....T...',
      '..hGGg..',
      '..GGSS..',
      '...BBS..',
      '...BB...',
      '..bB....',
      '..T.T...'
    ],
    [
      '.RWRWRWR',
      'RWRWRWRW',
      '....T...',
      '...hGGg.',
      '...GGSS.',
      '...SBB..',
      '....BB..',
      '....Bb..',
      '...T.T..'
    ],
    [
      '.RWRWRWR',
      'RWRWRWRW',
      '...T....',
      '..hGGg..',
      '..GGSS..',
      '...BBS..',
      '...BB...',
      '...Bb...',
      '..T..T..'
    ],
    [
      '.RWRWRWR',
      'RWRWRWRW',
      '....T...',
      '..hGGg..',
      '..GGSS..',
      '..SBBS..',
      '...BB...',
      '..b..b..',
      '..T..T..'
    ]
  ];

  // CLIMB (8 frames, reaching hand-over-hand up wall at right)
  const CLIMB_FRAMES = [
    [
      '....S...',
      '..hGGS..',
      '..GGSS..',
      '...BBcS.',
      '...BB...',
      '...BB...',
      '...b.T..',
      '..T.....',
      '........'
    ],
    [
      '........',
      '..hGGS..',
      '..GGSSS.',
      '...BBc..',
      '...BBS..',
      '...BB...',
      '...bT...',
      '...T....',
      '........'
    ],
    [
      '.....S..',
      '..hGG...',
      '..GGSS..',
      '...BBc..',
      '...BB.S.',
      '...BB...',
      '..Tb....',
      '....T...',
      '........'
    ],
    [
      '........',
      '..hGGS..',
      '..GGSSS.',
      '...BBc..',
      '...BBS..',
      '...BB...',
      '...b.T..',
      '...T....',
      '........'
    ],
    [
      '....S...',
      '..hGGS..',
      '..GGSS..',
      '...BBcS.',
      '...BB...',
      '...BB...',
      '...bT...',
      '..T.....',
      '........'
    ],
    [
      '........',
      '..hGGS..',
      '..GGSSS.',
      '...BBc..',
      '...BBS..',
      '...BB...',
      '..Tb....',
      '....T...',
      '........'
    ],
    [
      '....SS..',
      '..hGGS..',
      '..GGSS..',
      '...BBcS.',
      '...BB...',
      '...bB...',
      '....T...',
      '...T....',
      '........'
    ],
    [
      '........',
      '...hGGS.',
      '...GGSSS',
      '....BBc.',
      '....BBS.',
      '...bB...',
      '...T....',
      '........',
      '........'
    ]
  ];

  // BUILD (6 cycle frames x2 = 12 frames: reach sack, lift golden brick, lean forward, lay brick, step)
  const BUILD_BASE = [
    [
      '..hGGg....',
      '.gGGGSS...',
      '..gGSSS...',
      '..YBBc....',
      '..SBBB....',
      '...BBB....',
      '..bB.Bb...',
      '..T...T...',
      '..........'
    ],
    [
      '..hGGg....',
      '.gGGGSS...',
      '..gGSSS.Y.',
      '...cBBSSYY',
      '...BBB....',
      '...BBB....',
      '..bB.Bb...',
      '..T...T...',
      '..........'
    ],
    [
      '..........',
      '...hGGg...',
      '..gGGGSS..',
      '...gGSSS..',
      '....BBcSS.',
      '...BBB..YY',
      '...BBb....',
      '..T..T....',
      '..........'
    ],
    [
      '..........',
      '...hGGg...',
      '..gGGGSS..',
      '...gGSSS..',
      '....BBcS..',
      '...BBB..S.',
      '...BBb.YYY',
      '..T..T....',
      '..........'
    ],
    [
      '..hGGg....',
      '.gGGGSS...',
      '..gGSSS...',
      '...cBBS...',
      '...BBB....',
      '...BBB....',
      '..bB..b...',
      '..T...T...',
      '..........'
    ],
    [
      '..hGGg....',
      '.gGGGSS...',
      '..gGSSS...',
      '...cBB....',
      '...BBBS...',
      '...BBB....',
      '...BBb....',
      '...T.T....',
      '..........'
    ]
  ];
  const BUILD_FRAMES = BUILD_BASE.concat(BUILD_BASE);

  // SHRUG (6 frames: classic hands-out "out of bricks" shrug)
  const SHRUG_FRAMES = [
    [
      '..hGGg..',
      '.gGGGSS.',
      '..SSSS..',
      '.S.BB.S.',
      '...BB...',
      '...BB...',
      '..b..b..',
      '..T..T..',
      '........'
    ],
    [
      '.S.GG.S.',
      '..hGGh..',
      '..SSSS..',
      '..cBBc..',
      '...BB...',
      '...BB...',
      '..b..b..',
      '..T..T..',
      '........'
    ],
    [
      'S..GG..S',
      '..hGGh..',
      '..SSSS..',
      '..cBBc..',
      '...BB...',
      '...BB...',
      '..b..b..',
      '..T..T..',
      '........'
    ],
    [
      'S..GG..S',
      '..hGGh..',
      '..SSSS..',
      '..cBBc..',
      '...BB...',
      '...BB...',
      '..b..b..',
      '..T..T..',
      '........'
    ],
    [
      '.S.GG.S.',
      '..hGGh..',
      '..SSSS..',
      '..cBBc..',
      '...BB...',
      '...BB...',
      '..b..b..',
      '..T..T..',
      '........'
    ],
    [
      '..hGGg..',
      '.gGGGSS.',
      '..SSSS..',
      '...BB...',
      '..SBBS..',
      '...BB...',
      '..b..b..',
      '..T..T..',
      '........'
    ]
  ];

  // BASH (6 cycle frames x2 = 12 frames: horizontal scoop forward)
  const BASH_BASE = [
    [
      '..hGGg....',
      '.gGGGSS...',
      '..gGSSS...',
      '..SSBBc...',
      '...BBB....',
      '...BBB....',
      '..bB.Bb...',
      '..T...T...',
      '..........'
    ],
    [
      '..........',
      '...hGGg...',
      '..gGGGSS..',
      '...gGSSSM.',
      '....BBcSSM',
      '...BBB....',
      '..bB..Bb..',
      '.T.....T..',
      '..........'
    ],
    [
      '..........',
      '....hGGg..',
      '...gGGGSS.',
      '....gGSSS.',
      '....BBcSSM',
      '...BBB..MM',
      '..bB...Bb.',
      '.T......T.',
      '..........'
    ],
    [
      '..........',
      '....hGGg..',
      '...gGGGSS.',
      '....gGSSS.',
      '....BBc...',
      '...BBB.SSM',
      '..bB...Bb.',
      '.T......T.',
      '..........'
    ],
    [
      '..........',
      '...hGGg...',
      '..gGGGSS..',
      '...gGSSS..',
      '...SBBc...',
      '...BBB....',
      '..bB..Bb..',
      '..T...T...',
      '..........'
    ],
    [
      '..hGGg....',
      '.gGGGSS...',
      '..gGSSS...',
      '...cBBS...',
      '...BBB....',
      '...BBB....',
      '..bB.Bb...',
      '..T...T...',
      '..........'
    ]
  ];
  const BASH_FRAMES = BASH_BASE.concat(BASH_BASE);

  // MINE (5 cycle frames x2 = 10 frames: pickaxe overhead -> diagonal strike)
  const MINE_BASE = [
    [
      '....MM....',
      '..hGGTM...',
      '.gGGGSS...',
      '..gGSSS...',
      '...cBBS...',
      '...BBB....',
      '..bB.Bb...',
      '..T...T...',
      '..........'
    ],
    [
      '.....MM...',
      '..hGGgTM..',
      '.gGGGSS...',
      '..gGSSS...',
      '...cBBSS..',
      '...BBB....',
      '..bB.Bb...',
      '..T...T...',
      '..........'
    ],
    [
      '..........',
      '...hGGg...',
      '..gGGGSS..',
      '...gGSSS..',
      '....BBcSTM',
      '...BBB...M',
      '..bB..Bb..',
      '..T...T...',
      '..........'
    ],
    [
      '..........',
      '...hGGg...',
      '..gGGGSS..',
      '...gGSSS..',
      '....BBcS..',
      '...BBB.TM.',
      '..bB..BbM.',
      '..T...T..Y',
      '..........'
    ],
    [
      '..hGGg....',
      '.gGGGSS...',
      '..gGSSS...',
      '...cBBST..',
      '...BBB.M..',
      '...BBB....',
      '..bB.Bb...',
      '..T...T...',
      '..........'
    ]
  ];
  const MINE_FRAMES = MINE_BASE.concat(MINE_BASE);

  // DIG (8 frames: vertical shovel/jackhammer digging straight down)
  const DIG_FRAMES = [
    [
      '..hGGh..',
      '.GGGGGG.',
      '..SSSS..',
      '.SBBBBc.',
      '..STTS..',
      '...BB...',
      '..bMMb..',
      '..TMMT..',
      '...MM...'
    ],
    [
      '........',
      '..hGGh..',
      '.GGGGGG.',
      '..SSSS..',
      '.SBBBBc.',
      '..STTS..',
      '..bMMb..',
      '.YTMMTY.',
      '...MM...'
    ],
    [
      '..hGGh..',
      '.GGGGGG.',
      '..SSSS..',
      '.cBBBBS.',
      '..STTS..',
      '...BB...',
      '..bMMb..',
      '..TMMT..',
      '..YMMY..'
    ],
    [
      '........',
      '..hGGh..',
      '.GGGGGG.',
      '..SSSS..',
      '.cBBBBS.',
      '..STTS..',
      '..bMMb..',
      '..TMMT..',
      '...MM...'
    ],
    [
      '..hGGh..',
      '.GGGGGG.',
      '..SSSS..',
      '.SBBBBc.',
      '..STTS..',
      '...BB...',
      '..bMMb..',
      '.OTMMTO.',
      '...MM...'
    ],
    [
      '........',
      '..hGGh..',
      '.GGGGGG.',
      '..SSSS..',
      '.SBBBBc.',
      '..STTS..',
      '..bMMb..',
      '..TMMT..',
      '...MM...'
    ],
    [
      '..hGGh..',
      '.GGGGGG.',
      '..SSSS..',
      '.cBBBBS.',
      '..STTS..',
      '...BB...',
      '..bMMb..',
      '..TMMT..',
      '..OMMO..'
    ],
    [
      '........',
      '..hGGh..',
      '.GGGGGG.',
      '..SSSS..',
      '.cBBBBS.',
      '..STTS..',
      '..bMMb..',
      '..TMMT..',
      '...MM...'
    ]
  ];

  // BLOCK (8 frames: outstretched stop hands + beat head-bob & foot-tap!)
  const BLOCK_FRAMES = [
    [
      '..hGGh..',
      '.GGGGGG.',
      '..SSSS..',
      'SSBBBBSS',
      'S.cBBc.S',
      '...BB...',
      '..b..b..',
      '.TT..TT.',
      '........'
    ],
    [
      '..hGGh..',
      '.GGGGGG.',
      '..SSSS..',
      'SSBBBBSS',
      'S.cBBc.S',
      '...BB...',
      '..b..b..',
      '.TT...T.',
      '........'
    ],
    [
      '........',
      '..hGGh..',
      '.GGGGGG.',
      'SSBBBBSS',
      'S.cBBc.S',
      '...BB...',
      '..b..b..',
      '.TT..TT.',
      '........'
    ],
    [
      '........',
      '..hGGh..',
      '.GGGGGG.',
      'SSBBBBSS',
      'S.cBBc.S',
      '...BB...',
      '..b..b..',
      '.T...TT.',
      '........'
    ],
    [
      '..hGGh..',
      '.GGGGGG.',
      '..SSSS..',
      'SSBBBBSS',
      'S.cBBc.S',
      '...BB...',
      '..b..b..',
      '.TT..TT.',
      '........'
    ],
    [
      '..hGGh..',
      '.GGGGGG.',
      '..SSSS..',
      'SSBBBBSS',
      'S.cBBc.S',
      '...BB...',
      '..b..b..',
      '.TT...T.',
      '........'
    ],
    [
      '........',
      '..hGGh..',
      '.GGGGGG.',
      'SSBBBBSS',
      'S.cBBc.S',
      '...BB...',
      '..b..b..',
      '.TT..TT.',
      '........'
    ],
    [
      '........',
      '..hGGh..',
      '.GGGGGG.',
      'SSBBBBSS',
      'S.cBBc.S',
      '...BB...',
      '..b..b..',
      '.T...TT.',
      '........'
    ]
  ];

  // OH NO! (6 frames: hands on head trembling before Bomber explosion)
  const OHNO_FRAMES = [
    [
      '.S.GG.S.',
      '.ShGGhS.',
      '..SSSS..',
      '...BB...',
      '..cBBc..',
      '...BB...',
      '..b..b..',
      '..T..T..',
      '........'
    ],
    [
      '........',
      '.ShGGhS.',
      '..SSSS..',
      '..SBBS..',
      '..RYYR..',
      '...BB...',
      '.b....b.',
      '.T....T.',
      '........'
    ],
    [
      '.S.GG.S.',
      '.ShGGhS.',
      '..WWWW..',
      '...YY...',
      '..OYWO..',
      '...RR...',
      '..b..b..',
      '..T..T..',
      '........'
    ],
    [
      '........',
      '.ShGGhS.',
      '..SSSS..',
      '..OYWO..',
      '..WYYW..',
      '..ORRO..',
      '.b....b.',
      '.T....T.',
      '........'
    ],
    [
      '.W.YY.W.',
      '.WYWWYW.',
      '..WWWW..',
      '..WYYW..',
      '..YYYY..',
      '..ORRO..',
      '..R..R..',
      '........',
      '........'
    ],
    [
      'W..YY..W',
      '.WYYYYW.',
      '.YYYYYY.',
      '.YWWWWY.',
      '.YYYYYY.',
      '.OORROO.',
      '........',
      '........',
      '........'
    ]
  ];

  // SPLAT (8 frames: high-fall impact flatten)
  const SPLAT_FRAMES = [
    [
      '........',
      '........',
      '..GGGG..',
      '.SBBBBc.',
      '.bBBBBb.',
      '.TT..TT.',
      '........',
      '........',
      '........'
    ],
    [
      '........',
      '........',
      '........',
      '.GGGGGG.',
      'SBBBBBBc',
      'TTbbbbTT',
      '........',
      '........',
      '........'
    ],
    [
      '........',
      '........',
      '........',
      '........',
      'GGBBBBGG',
      'TSBBBBST',
      'TTTTTTTT',
      '........',
      '........'
    ],
    [
      '........',
      '........',
      '........',
      '........',
      '........',
      'GSBBBBGS',
      'TbbbbbbT',
      '........',
      '........'
    ],
    [
      '........',
      '........',
      '........',
      '........',
      '........',
      '.G.BB.G.',
      'TbbbbbbT',
      '........',
      '........'
    ],
    [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '.bb..bb.',
      '........',
      '........'
    ],
    [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '..b..b..',
      '........',
      '........'
    ],
    [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........'
    ]
  ];

  // DROWN (8 frames: splashing & bubbles in water)
  const DROWN_FRAMES = [
    [
      '.S....S.',
      '.ShGGhS.',
      '..SSSS..',
      'AABBBBAA',
      '.AAAAAA.',
      '........'
    ],
    [
      'S..AA..S',
      '..hGGh..',
      '.ASSSSA.',
      'AAAAAAAA',
      '........',
      '........'
    ],
    [
      '...A....',
      '.S.GG.S.',
      '..AGGG..',
      'AAAAAAAA',
      '........',
      '........'
    ],
    [
      '..A..A..',
      '...GG...',
      '.AAAAAA.',
      '........',
      '........',
      '........'
    ],
    [
      '....A...',
      '..A..A..',
      '.AAAAAA.',
      '........',
      '........',
      '........'
    ],
    [
      '..A.....',
      '....A...',
      '..AAAA..',
      '........',
      '........',
      '........'
    ],
    [
      '....A...',
      '........',
      '...AA...',
      '........',
      '........',
      '........'
    ],
    [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........'
    ]
  ];

  // BURN (8 frames: flame burst -> ash puff)
  const BURN_FRAMES = [
    [
      '..O..O..',
      '.OYYYYO.',
      '.YWSSWY.',
      '.OYBBYO.',
      '..ORRO..',
      '..R..R..',
      '........',
      '........'
    ],
    [
      '.O.YY.O.',
      'OYYYYYYO',
      '.YWWWWY.',
      '.OYYYYO.',
      '..ORRO..',
      '...KK...',
      '........',
      '........'
    ],
    [
      '..OYYO..',
      '.OYWWYO.',
      '..OYYO..',
      '..KKKK..',
      '..K..K..',
      '........',
      '........',
      '........'
    ],
    [
      '...OO...',
      '..ORRO..',
      '..KKKK..',
      '..KKKK..',
      '...KK...',
      '........',
      '........',
      '........'
    ],
    [
      '..K..K..',
      '...KK...',
      '..KKKK..',
      '...KK...',
      '........',
      '........',
      '........',
      '........'
    ],
    [
      '.K....K.',
      '...KK...',
      '....K...',
      '........',
      '........',
      '........',
      '........',
      '........'
    ],
    [
      '..K..K..',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........'
    ],
    [
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........'
    ]
  ];

  // CELEBRATE (8 frames: exit-door celebration hop! Jumps up in V-pose and enters door)
  const CELEBRATE_FRAMES = [
    [
      '.S....S.',
      '.ShGGhS.',
      '..GGGG..',
      '..SSSS..',
      '...BB...',
      '...BB...',
      '..b..b..',
      '..T..T..',
      '........'
    ],
    [
      'S..YY..S',
      '.ShGGhS.',
      '..SSSS..',
      '..cBBc..',
      '...BB...',
      '..T..T..',
      '........',
      '........',
      '........'
    ],
    [
      'W.hGGh.W',
      '.SGGGGS.',
      '..SSSS..',
      '..cBBc..',
      '..T..T..',
      '........',
      '........',
      '........',
      '........'
    ],
    [
      '.Y.GG.Y.',
      '..SSSS..',
      '..cBBc..',
      '...TT...',
      '........',
      '........',
      '........',
      '........',
      '........'
    ],
    [
      '..WYYW..',
      '..GGGG..',
      '...BB...',
      '...TT...',
      '........',
      '........',
      '........',
      '........',
      '........'
    ],
    [
      '...WW...',
      '...GG...',
      '...BB...',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........'
    ],
    [
      '...YY...',
      '..YWWY..',
      '...YY...',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........'
    ],
    [
      '....W...',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........'
    ]
  ];

  const ANIMS = {
    WALK: makeAnim(WALK_FRAMES, 4, 8),
    FALL: makeAnim(FALL_FRAMES, 4, 8),
    FLOAT: makeAnim(FLOAT_FRAMES, 4, 9),
    CLIMB: makeAnim(CLIMB_FRAMES, 4, 8),
    BUILD: makeAnim(BUILD_FRAMES, 4, 8),
    SHRUG: makeAnim(SHRUG_FRAMES, 4, 8),
    BASH: makeAnim(BASH_FRAMES, 4, 8),
    MINE: makeAnim(MINE_FRAMES, 4, 8),
    DIG: makeAnim(DIG_FRAMES, 4, 8),
    BLOCK: makeAnim(BLOCK_FRAMES, 4, 8),
    OHNO: makeAnim(OHNO_FRAMES, 4, 8),
    SPLAT: makeAnim(SPLAT_FRAMES, 4, 7),
    DROWN: makeAnim(DROWN_FRAMES, 4, 4),
    BURN: makeAnim(BURN_FRAMES, 4, 6),
    CELEBRATE: makeAnim(CELEBRATE_FRAMES, 4, 8)
  };

  // =========================================================================
  // 2. HUD SKILL & CONTROL BUTTON ICONS (12x16 interior pixel art)
  // =========================================================================
  const HUD_ICONS_ASCII = {
    RATE_MINUS: [
      '............',
      '....MMMM....',
      '...M....M...',
      '............',
      '..RRRRRRRR..',
      '..RRRRRRRR..',
      '............',
      '....hGGg....',
      '....GGSS....',
      '.....BB.....',
      '....T..T....',
      '............'
    ],
    RATE_PLUS: [
      '.....RR.....',
      '.....RR.....',
      '..RRRRRRRR..',
      '..RRRRRRRR..',
      '.....RR.....',
      '.....RR.....',
      '............',
      '..GG....GG..',
      '..SS....SS..',
      '..BB....BB..',
      '.T..T..T..T.',
      '............'
    ],
    CLIMBER: [
      '........MM..',
      '.....S..MM..',
      '...hGGS.MM..',
      '...GGSSSMM..',
      '....BBc.MM..',
      '....BBS.MM..',
      '....BB..MM..',
      '...Tb...MM..',
      '.....T..MM..',
      '........MM..',
      '..YYYY..MM..',
      '............'
    ],
    FLOATER: [
      '..RWRWRWRW..',
      '.RWRWRWRWRW.',
      '.....T......',
      '.....T......',
      '...hGGg.....',
      '...GGSS.....',
      '....BBS.....',
      '....BB......',
      '...b..b.....',
      '...T..T.....',
      '..AAAAAA....',
      '............'
    ],
    BOMBER: [
      '....Y..Y....',
      '..W.OYYO.W..',
      '...ShGGhS...',
      '....SSSS....',
      '...OYYWYO...',
      '....RRRR....',
      '...b....b...',
      '...T....T...',
      '..O..YY..O..',
      '............',
      '...RRRRRR...',
      '............'
    ],
    BLOCKER: [
      '...hGGh.....',
      '..GGGGGG....',
      '...SSSS.....',
      '.SSBBBBSS...',
      '.S.cBBc.S...',
      '....BB......',
      '...b..b.....',
      '..TT..TT....',
      '............',
      '.AA.YYYY.AA.',
      '............',
      '............'
    ],
    BUILDER: [
      '..hGGg......',
      '..GGSS..YY..',
      '...BBcSSYY..',
      '...BBB......',
      '..b..b..YYYY',
      '..T..T.YYYY.',
      '.....YYYY...',
      '...YYYY.....',
      '.YYYY.......',
      'YYYY........',
      '............',
      '............'
    ],
    BASHER: [
      '............',
      '...hGGg.MMM.',
      '..gGGGSSMMM.',
      '...BBcSSMMM.',
      '..BBB...MMM.',
      '.bB..Bb.MMM.',
      '.T....T.MMM.',
      '........MMM.',
      '..OOOOOO....',
      '............',
      '............',
      '............'
    ],
    MINER: [
      '.....MMM....',
      '..hGGTM.....',
      '..GGSS......',
      '...BBST.....',
      '...BBB.M....',
      '..b..b..M...',
      '..T..T...Y..',
      '........YY..',
      '......YYYY..',
      '....YYYY....',
      '............',
      '............'
    ],
    DIGGER: [
      '...hGGh.....',
      '..GGGGGG....',
      '...SSSS.....',
      '..SBBBBc....',
      '...STTS.....',
      '...bMMb.....',
      '..YTMMTY....',
      '....MM......',
      '..OO..OO....',
      '.OO....OO...',
      '............',
      '............'
    ],
    PAUSE: [
      '............',
      '..YYY..YYY..',
      '..YYY..YYY..',
      '..YYY..YYY..',
      '..YYY..YYY..',
      '..YYY..YYY..',
      '..YYY..YYY..',
      '..YYY..YYY..',
      '..YYY..YYY..',
      '............',
      '............',
      '............'
    ],
    FF: [
      '............',
      '.AA...AA....',
      '.AAA..AAA...',
      '.AAAA.AAAA..',
      '.AAAAA.AAAA.',
      '.AAAA.AAAA..',
      '.AAA..AAA...',
      '.AA...AA....',
      '............',
      '............',
      '............',
      '............'
    ],
    NUKE: [
      '...RRRRRR...',
      '..RYYYYYYR..',
      '.RYWWWWWWYR.',
      '.RRRRRRRRRR.',
      '....OOOO....',
      '....YYYY....',
      '....OOOO....',
      '...OYYYYO...',
      '..RRRRRRRR..',
      '.RRRRRRRRRR.',
      '............',
      '............'
    ]
  };

  const HUD_ICONS = {};
  for (const key of Object.keys(HUD_ICONS_ASCII)) {
    HUD_ICONS[key] = compileAsciiFrame(HUD_ICONS_ASCII[key], 0, 0);
  }

  // Blit a compiled sprite into the 320x200 framebuffer (clipped to playfield or full screen)
  function blitSprite(fb, fbW, fbH, frame, x, y, silent = false, maxY = fbH, headBobY = 0) {
    const src = silent ? frame.pxSilent : frame.px;
    const x0 = (x - frame.ox) | 0;
    const y0 = (y - frame.oy) | 0;
    for (let sy = 0; sy < frame.h; sy++) {
      // Apply tempo head-bob to top 3 rows (head & hair) for lively musical bounce!
      const bob = sy <= 2 ? headBobY : 0;
      const py = y0 + sy + bob;
      if (py < 0 || py >= maxY || py >= fbH) continue;
      const dstRow = py * fbW;
      const srcRow = sy * frame.w;
      for (let sx = 0; sx < frame.w; sx++) {
        const col = src[srcRow + sx];
        if (col) {
          const px = x0 + sx;
          if (px >= 0 && px < fbW) {
            fb[dstRow + px] = col;
          }
        }
      }
    }
  }

  // Draw Entrance Hatch (trapdoor with animated opening flaps + equalizer lights)
  function drawHatch(fb, fbW, playH, wx, wy, camX, openProgress, beatPulse, accentCol) {
    const sx = (wx - camX) | 0;
    const sy = wy | 0;
    if (sx < -24 || sx > fbW + 24) return;

    const woodDark = packRGBA(92, 54, 28);
    const woodMid = packRGBA(146, 92, 46);
    const woodHi = packRGBA(198, 138, 76);
    const iron = packRGBA(140, 152, 172);
    const darkHole = packRGBA(12, 10, 20);

    // Main hatch housing (22x12 centered at sx, bottom at sy)
    const hx = sx - 11;
    const hy = sy - 12;
    Font.fillRect(fb, fbW, playH, hx, hy, 22, 12, woodDark);
    Font.fillRect(fb, fbW, playH, hx + 1, hy + 1, 20, 10, darkHole);
    Font.strokeRect(fb, fbW, playH, hx, hy, 22, 12, woodMid);
    Font.fillRect(fb, fbW, playH, hx, hy, 22, 2, woodHi);

    // Corner rivets + beat-synced LED strip
    const ledCol = beatPulse > 0.55 ? accentCol : woodHi;
    Font.fillRect(fb, fbW, playH, hx + 2, hy + 2, 2, 2, iron);
    Font.fillRect(fb, fbW, playH, hx + 18, hy + 2, 2, 2, iron);
    Font.fillRect(fb, fbW, playH, hx + 8, hy + 1, 6, 2, ledCol);

    // Animated swinging trapdoor flaps underneath
    const angleSteps = Math.min(4, Math.floor(openProgress * 4.99));
    if (angleSteps === 0) {
      Font.fillRect(fb, fbW, playH, hx + 2, sy, 9, 2, woodHi);
      Font.fillRect(fb, fbW, playH, hx + 11, sy, 9, 2, woodMid);
    } else if (angleSteps <= 2) {
      for (let i = 0; i < 6; i++) {
        Font.fillRect(fb, fbW, playH, hx + 1 + i, sy + i, 2, 2, woodHi);
        Font.fillRect(fb, fbW, playH, hx + 19 - i, sy + i, 2, 2, woodMid);
      }
    } else {
      Font.fillRect(fb, fbW, playH, hx + 1, sy, 2, 7, woodHi);
      Font.fillRect(fb, fbW, playH, hx + 19, sy, 2, 7, woodMid);
    }
  }

  // Draw Musical Exit Temple / Portal Door (24x22 centered at wx, standing on wy)
  function drawExitDoor(fb, fbW, playH, wx, wy, camX, frameCount, beatPulse, exitFlash, worldTheme) {
    const sx = (wx - camX) | 0;
    const sy = wy | 0;
    if (sx < -26 || sx > fbW + 26) return;

    const stoneDark = worldTheme ? worldTheme.exitDark : packRGBA(58, 48, 86);
    const stoneMid = worldTheme ? worldTheme.exitMid : packRGBA(118, 102, 168);
    const stoneHi = worldTheme ? worldTheme.exitHi : packRGBA(215, 196, 255);
    const gold = packRGBA(255, 214, 68);
    const portalCore = exitFlash > 0
      ? packRGBA(255, 255, 220)
      : (beatPulse > 0.5 ? packRGBA(82, 228, 255) : packRGBA(36, 128, 214));

    const ex = sx - 12;
    const ey = sy - 20;

    // Pedestal & Columns
    Font.fillRect(fb, fbW, playH, ex - 2, sy - 2, 28, 2, stoneHi);
    Font.fillRect(fb, fbW, playH, ex, ey + 4, 24, 14, stoneDark);
    Font.fillRect(fb, fbW, playH, ex + 1, ey + 4, 4, 14, stoneMid);
    Font.fillRect(fb, fbW, playH, ex + 19, ey + 4, 4, 14, stoneMid);
    Font.fillRect(fb, fbW, playH, ex + 1, ey + 4, 1, 14, stoneHi);
    Font.fillRect(fb, fbW, playH, ex + 19, ey + 4, 1, 14, stoneHi);

    // Stepped Arch Roof
    Font.fillRect(fb, fbW, playH, ex - 1, ey + 2, 26, 2, stoneMid);
    Font.fillRect(fb, fbW, playH, ex + 2, ey, 20, 2, stoneHi);
    Font.fillRect(fb, fbW, playH, sx - 2, ey - 3, 4, 3, gold);

    // Glowing Musical Doorway Interior (10x12)
    Font.fillRect(fb, fbW, playH, sx - 5, sy - 14, 10, 12, packRGBA(10, 12, 28));
    // Equalizer bars dancing inside the exit portal!
    for (let b = 0; b < 4; b++) {
      const wave = Math.sin(frameCount * 0.16 + b * 1.3) * 0.5 + 0.5;
      const bh = Math.max(2, Math.min(10, Math.round((wave * 0.6 + beatPulse * 0.5 + (exitFlash > 0 ? 0.5 : 0)) * 10)));
      const bx = sx - 4 + b * 2;
      Font.fillRect(fb, fbW, playH, bx, sy - 2 - bh, 2, bh, portalCore);
    }

    // Twin flickering torches / resonance beacons on top corners
    const flick = ((frameCount >> 2) & 1) ? 1 : 0;
    const flameOuter = packRGBA(255, 120, 32);
    Font.fillRect(fb, fbW, playH, ex + 1, ey - 3 - flick, 3, 3 + flick, flameOuter);
    Font.fillRect(fb, fbW, playH, ex + 2, ey - 2, 1, 2, gold);
    Font.fillRect(fb, fbW, playH, ex + 20, ey - 3 - (1 - flick), 3, 3 + (1 - flick), flameOuter);
    Font.fillRect(fb, fbW, playH, ex + 21, ey - 2, 1, 2, gold);
  }

  BeatTribe.Sprites = {
    PAL,
    ANIMS,
    HUD_ICONS,
    blitSprite,
    drawHatch,
    drawExitDoor
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BeatTribe.Sprites;
  }
})(typeof window !== 'undefined' ? window : globalThis);
