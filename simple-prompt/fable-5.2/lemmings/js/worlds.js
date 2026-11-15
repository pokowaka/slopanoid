/* BEAT TRIBE - the six genre worlds (tutorial meadow + 5 worlds).
 * `scale`  = the fixed scale painted onto the terrain (what lemmings play).
 * `mode`   = 7-note parent mode the tracker song is written in.
 * `root`   = MIDI note of scale degree 0 in the middle height band. */
(function (g) {
  'use strict';
  var BT = g.BT, hex = BT.hex;

  var DEG5 = [0xf04848, 0xf0d040, 0x50d858, 0x40c8f0, 0xb070f8].map(hex);
  var DEG7 = [0xf04848, 0xf89038, 0xf0d040, 0x50d858, 0x40c8f0, 0x5080f8, 0xe060d8].map(hex);

  BT.WORLDS = [
    { key: 'meadow', name: 'TRAINING MEADOW', genre: 'CHIP JINGLE', scaleName: 'C MAJOR PENTATONIC',
      scale: [0, 2, 4, 7, 9], mode: [0, 2, 4, 5, 7, 9, 11], root: 60, bpm: 108, accent: 0x90e860 },
    { key: 'garden', name: 'AMIGA CHIP GARDEN', genre: '4-CHANNEL CHIPTUNE', scaleName: 'D MAJOR PENTATONIC',
      scale: [0, 2, 4, 7, 9], mode: [0, 2, 4, 5, 7, 9, 11], root: 62, bpm: 126, accent: 0x60e890 },
    { key: 'acid', name: 'ACID WAREHOUSE', genre: 'TB-303 ACID HOUSE', scaleName: 'A PHRYGIAN',
      scale: [0, 1, 3, 5, 7, 8, 10], mode: [0, 1, 3, 5, 7, 8, 10], root: 57, bpm: 132, accent: 0xf0e040 },
    { key: 'sunset', name: 'SYNTHWAVE SUNSET', genre: 'SYNTHWAVE', scaleName: 'D DORIAN',
      scale: [0, 2, 3, 5, 7, 9, 10], mode: [0, 2, 3, 5, 7, 9, 10], root: 62, bpm: 104, accent: 0xff60c0 },
    { key: 'cave', name: 'JUNGLE BREAKBEAT CAVES', genre: 'JUNGLE / DRUM AND BASS', scaleName: 'F MINOR PENTATONIC',
      scale: [0, 3, 5, 7, 10], mode: [0, 2, 3, 5, 7, 8, 10], root: 65, bpm: 168, accent: 0x40f0c0 },
    { key: 'hall', name: 'GRAND ORCHESTRAL FINALE', genre: 'SYMPHONIC', scaleName: 'G LYDIAN',
      scale: [0, 2, 4, 6, 7, 9, 11], mode: [0, 2, 4, 6, 7, 9, 11], root: 55, bpm: 96, accent: 0xf8d878 }
  ];
  BT.WORLDS.forEach(function (w, i) {
    w.index = i;
    w.sf = 900 / w.bpm;                       // sim frames per 1/16 step (60fps * 60s / (bpm * 4))
    w.degCols = w.scale.length === 5 ? DEG5 : DEG7;
  });

  // Scale degree index (may exceed the scale length = next octave) -> MIDI note.
  BT.noteMidi = function (w, deg, oct) {
    var n = w.scale.length, o = Math.floor(deg / n);
    return w.root + 12 * ((oct || 0) + o) + w.scale[deg - o * n];
  };
  BT.degColor = function (w, deg) { var n = w.degCols.length; return w.degCols[((deg % n) + n) % n]; };
  // Same, for the 7-note song mode (used by the tracker patterns).
  BT.modeMidi = function (w, base, deg) {
    var o = Math.floor(deg / 7);
    return base + 12 * o + w.mode[deg - o * 7];
  };
})(typeof window !== 'undefined' ? window : globalThis);
