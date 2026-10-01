/* Minimal dependency-free PNG writer + level snapshot helper (dev tool). */
'use strict';
const zlib = require('zlib');
const fs = require('fs');

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, w, h, rgb) { // rgb: Uint8Array w*h*3
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

/* Snapshot: terrain + objects + trails (array of [x,y,colorRGB]). scale 2. */
function snapshot(BT, sim, file, trails, initialTerrain) {
  const W = sim.W, H = sim.H, S = 2;
  const rgb = new Uint8Array(W * S * H * S * 3);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const k = ((y * S + j) * W * S + x * S + i) * 3;
      rgb[k] = c[0]; rgb[k + 1] = c[1]; rgb[k + 2] = c[2];
    }
  };
  const world = sim.world;
  const T = sim.terrain;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let c = [16, 16, 32];
    if (sim.sil[x] > 0.5) c = [60, 60, 60];
    const m = T.mat[i];
    if (initialTerrain && initialTerrain.mat[i] && !m) c = [70, 30, 30];
    if (m === 1) { const d = world.deg[T.deg[i] % world.deg.length]; c = [d[0] * 0.8, d[1] * 0.8, d[2] * 0.8]; }
    else if (m === 2) c = [150, 150, 170];
    else if (m === 3 || m === 4) c = [200, 100, 40];
    put(x, y, c);
  }
  for (const o of sim.traps) {
    const col = o.type === 'water' ? [40, 80, 255] : o.type === 'lava' ? [255, 60, 0] : o.type === 'fire' ? [255, 160, 0] : [255, 0, 255];
    if (o.type === 'crusher') { for (let y = o.y - 12; y <= o.y; y++) for (let x = o.x - 4; x <= o.x + 4; x++) put(x, y, col); }
    else for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) put(x, y, col);
  }
  for (const e of sim.entrances) for (let y = e.y; y < e.y + 14; y++) for (let x = e.x - 8; x <= e.x + 8; x++) put(x, y, [255, 255, 0]);
  for (const e of sim.exits) for (let y = e.y - 12; y <= e.y; y++) for (let x = e.x - 5; x <= e.x + 5; x++) put(x, y, [0, 255, 0]);
  if (trails) for (const t of trails) put(t[0], t[1], t[2]);
  writePNG(file, W * S, H * S, rgb);
}
module.exports = { writePNG, snapshot };
